import { readSecret } from './db';
import { storageDownload, storageSign } from './rest';
import { info } from './logger';

/**
 * Discord publisher (bot token, https://discord.com/api/v10).
 *
 * Verified against the official docs (message resource):
 * - POST /channels/{id}/messages, auth `Bot <token>`
 * - content caps at 2000 chars (backend validates — no silent truncation)
 * - file uploads via multipart files[n] (25 MB safe cap; boosted guilds
 *   allow more and the API error surfaces if we ever exceed it)
 * - links auto-embed on Discord's side — no embed payload needed
 *
 * The bot token is long-lived (no refresh endpoint): plain vault read.
 * No threads in v1 — plain channel messages only.
 */

const API = 'https://discord.com/api/v10';
const CONTENT_MAX = 2000;
const MAX_FILES = 10;

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
}

async function callDiscord<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, ...(init?.headers ?? {}) },
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-reset-after') ?? '5');
    throw new Error(`Discord rate-limited this channel — retry in ${Math.ceil(retry)}s.`);
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string; code?: number }) | null;
  if (!res.ok || !json) {
    const detail =
      typeof json?.message === 'string' && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(`Discord refused the post: ${detail}`);
  }
  return json;
}

/** discord.com/channels/{guild}/{channel}/{message} — guild from connect-time metadata. */
function postUrl(b: Bundle, channelId: string, messageId: string): string {
  const guild = b.channel.metadata?.guildId;
  return typeof guild === 'string' && guild
    ? `https://discord.com/channels/${guild}/${channelId}/${messageId}`
    : `https://discord.com/channels/${channelId}/${messageId}`;
}

export async function publishDiscordTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  const channelId = String(b.channel.external_id ?? '').trim();
  if (!channelId) throw new Error('Discord destination is missing — reconnect the channel in Connect.');
  if (!b.secrets.access_secret_id) {
    throw new Error('Discord bot token is missing — reconnect the channel in Connect.');
  }
  const token = await readSecret(b.secrets.access_secret_id);
  if (!token) {
    throw new Error('Discord bot token is missing — reconnect the channel in Connect.');
  }

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  if (text.length > CONTENT_MAX) {
    throw new Error(
      `Discord messages cap at ${CONTENT_MAX} characters (this one is ${text.length}) — shorten the text.`,
    );
  }

  // Threaded reply: the message id was stored on the target options by the
  // inbox reply flow. fail_if_not_exists false keeps the send alive if the
  // original was deleted.
  const replyTo =
    b.target.options && typeof (b.target.options as Record<string, unknown>).replyTo === 'string'
      ? String((b.target.options as Record<string, unknown>).replyTo)
      : '';
  const reference = replyTo ? { message_reference: { message_id: replyTo, fail_if_not_exists: false } } : {};

  const media = [...(b.media ?? [])]
    .filter((m) => m.kind === 'image' || m.kind === 'video')
    .sort((a, z) => a.position - z.position)
    .slice(0, MAX_FILES);

  // ---- text only ----
  if (media.length === 0) {
    if (!text) throw new Error('Discord needs text or a file — this post has neither.');
    const msg = await callDiscord<DiscordMessage>(token, `/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text, allowed_mentions: { parse: [] }, ...reference }),
    });
    info('discord message sent', { target: b.target.id, message: msg.id });
    return { remoteId: msg.id, remoteUrl: postUrl(b, msg.channel_id, msg.id) };
  }

  // ---- files (multipart files[n]) ----
  const form = new FormData();
  const payload: Record<string, unknown> = { allowed_mentions: { parse: [] }, ...reference };
  if (text) payload.content = text;
  form.append('payload_json', JSON.stringify(payload));
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    const bytes = await storageDownload(await storageSign('post-media', m.storage_path), 25 * 1024 * 1024);
    const ext = m.kind === 'video' ? 'mp4' : 'jpg';
    const mime = m.mime_type ?? (m.kind === 'video' ? 'video/mp4' : 'image/jpeg');
    form.append(`files[${i}]`, new Blob([new Uint8Array(bytes)], { type: mime }), `sosial-${i}.${ext}`);
  }
  const msg = await callDiscord<DiscordMessage>(token, `/channels/${channelId}/messages`, {
    method: 'POST',
    body: form,
  });
  info('discord files sent', { target: b.target.id, message: msg.id, count: media.length });
  return { remoteId: msg.id, remoteUrl: postUrl(b, msg.channel_id, msg.id) };
}

/** Connect-time helpers (used by the edge function, same verified surface). */
export async function discordMe(token: string): Promise<{ id: string; username: string }> {
  const me = await callDiscord<{ id: string; username: string }>(token, '/users/@me', { method: 'GET' });
  return { id: me.id, username: me.username };
}

export async function discordGuilds(token: string): Promise<{ id: string; name: string }[]> {
  const guilds = await callDiscord<{ id: string; name: string }[]>(token, '/users/@me/guilds', { method: 'GET' });
  return (guilds ?? []).map((g) => ({ id: g.id, name: g.name }));
}

export async function discordTextChannels(
  token: string,
  guildId: string,
): Promise<{ id: string; name: string; type: number }[]> {
  const channels = await callDiscord<{ id: string; name: string; type: number }[]>(
    token,
    `/guilds/${guildId}/channels`,
    { method: 'GET' },
  );
  // Guild text (0) + announcement (5) channels only — no voice, stages, or categories.
  return (channels ?? [])
    .filter((c) => c.type === 0 || c.type === 5)
    .map((c) => ({ id: c.id, name: c.name, type: c.type }));
}
