import { readSecret } from './db';
import { required } from './env';
import { info, warn } from './logger';

/**
 * Discord inbox poll (REST, no gateway to babysit). Every 5 minutes pg_cron
 * enqueues one sync_inbox job per connected Discord channel; we pull messages
 * newer than the last stored one and append them to channel_messages.
 *
 * Skipped: our own bot's messages (author.id match) and contentless system
 * pings. Edits/deletes are not tracked in v1 — first-seen wins.
 */

const API = 'https://discord.com/api/v10';

function base(): string {
  return required('WORKER_SUPABASE_URL').replace(/\/+$/, '');
}

function key(): string {
  return required('WORKER_SERVICE_ROLE_KEY');
}

function auth(): Record<string, string> {
  return { apikey: key(), Authorization: `Bearer ${key()}` };
}

interface DiscordAuthor {
  id: string;
  username: string;
  global_name?: string | null;
  bot?: boolean;
}

interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  author: DiscordAuthor;
  attachments?: { id: string }[];
  message_reference?: { message_id?: string };
  type: number;
}

async function botGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bot ${token}` } });
  if (res.status === 429) {
    const retry = res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-reset-after') ?? '5';
    throw new Error(`Discord rate-limited inbox poll — retry in ${Math.ceil(Number(retry))}s.`);
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !json) {
    const detail = typeof json?.message === 'string' && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(`Discord inbox poll failed: ${detail}`);
  }
  return json;
}

async function lastStoredExternalId(channelId: string): Promise<string | null> {
  const url =
    `${base()}/rest/v1/channel_messages?channel_id=eq.${channelId}` +
    `&select=external_id&order=external_created_at.desc&limit=1`;
  const r = await fetch(url, { headers: auth() });
  if (!r.ok) throw new Error(`read inbox watermark (${r.status})`);
  const rows = (await r.json().catch(() => [])) as { external_id: string }[];
  return rows?.[0]?.external_id ?? null;
}

export interface InboundDraft {
  external_id: string;
  author_name: string;
  author_handle: string;
  body: string;
  has_media: boolean;
  external_created_at: string;
  reply_to_external_id: string | null;
}

/**
 * Pure filter: which fetched messages become inbox rows. Own bot messages
 * and contentless system pings (type !== 0 with no text) are skipped.
 */
export function selectInbound(messages: DiscordMessage[], botId: string): InboundDraft[] {
  const out: InboundDraft[] = [];
  for (const m of messages ?? []) {
    if (!m || typeof m.id !== 'string') continue;
    if (m.author?.id === botId) continue;
    const body = typeof m.content === 'string' ? m.content : '';
    const hasMedia = Array.isArray(m.attachments) && m.attachments.length > 0;
    if (!body.trim() && !hasMedia) continue;
    out.push({
      external_id: m.id,
      author_name: m.author?.global_name || m.author?.username || 'Someone',
      author_handle: m.author?.username ?? '',
      body: body.trim() || '(attachment)',
      has_media: hasMedia,
      external_created_at: m.timestamp,
      reply_to_external_id: m.message_reference?.message_id ?? null,
    });
  }
  return out;
}

async function storeRows(args: {
  workspaceId: string;
  channelId: string;
  rows: InboundDraft[];
}): Promise<number> {
  if (!args.rows.length) return 0;
  const body = args.rows.map((r) => ({
    workspace_id: args.workspaceId,
    channel_id: args.channelId,
    provider: 'discord',
    external_id: r.external_id,
    author_name: r.author_name,
    author_handle: r.author_handle,
    body: r.body,
    has_media: r.has_media,
    external_created_at: r.external_created_at,
    reply_to_external_id: r.reply_to_external_id,
    raw: {},
  }));
  const r = await fetch(`${base()}/rest/v1/channel_messages?on_conflict=channel_id,external_id`, {
    method: 'POST',
    headers: { ...auth(), 'content-type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`store inbox rows (${r.status}): ${t.slice(0, 200)}`);
  }
  return args.rows.length;
}

export async function syncDiscordInbox(channelId: string): Promise<{ stored: number }> {
  // Channel + token secret (same join shape as the avatar sync).
  const url =
    `${base()}/rest/v1/connected_channels?id=eq.${channelId}` +
    `&select=id,workspace_id,provider,external_id,channel_tokens(access_token_secret_id)` +
    `&limit=1`;
  const r = await fetch(url, { headers: auth() });
  if (!r.ok) throw new Error(`load inbox channel (${r.status})`);
  const rows = (await r.json().catch(() => [])) as {
    id: string;
    workspace_id: string;
    provider: string;
    external_id: string;
    channel_tokens: { access_token_secret_id: string | null } | null;
  }[];
  const ch = rows?.[0];
  if (!ch || ch.provider !== 'discord') throw new Error('Inbox channel is not a Discord channel.');
  const secretId = ch.channel_tokens?.access_token_secret_id;
  if (!secretId) throw new Error('Discord bot token is missing — reconnect the channel in Connect.');
  const token = await readSecret(secretId);
  if (!token) throw new Error('Discord bot token is missing — reconnect the channel in Connect.');

  const me = await botGet<{ id: string }>(token, '/users/@me');
  const after = await lastStoredExternalId(ch.id);
  const path =
    `/channels/${ch.external_id}/messages?limit=50` + (after ? `&after=${after}` : '');
  const messages = await botGet<DiscordMessage[]>(token, path);
  const inbound = selectInbound(Array.isArray(messages) ? messages : [], me.id);
  const stored = await storeRows({ workspaceId: ch.workspace_id, channelId: ch.id, rows: inbound });
  info(`sync_inbox discord ${ch.external_id}: ${stored} stored`);
  return { stored };
}
