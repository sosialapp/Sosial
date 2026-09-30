import { readSecret } from './db';
import { storageDownload, storageSign } from './rest';
import { info, warn } from './logger';

/**
 * Telegram publisher (Bot API, https://api.telegram.org/bot<token>/METHOD).
 *
 * Verified against the official Bot API docs:
 * - sendMessage        text
 * - sendPhoto          single image (+ caption)
 * - sendVideo          single video (+ caption)
 * - sendMediaGroup     album of up to 10 photos/videos (uploaded by attach://)
 *
 * The bot token is long-lived (no refresh endpoint), so the token path is a
 * plain vault read — same as every other provider, minus expiry handling.
 * Telegram's own API has no scheduling; Sosial's worker publishes at the
 * scheduled time, which is the existing pipeline behaviour for all channels.
 */

const API = 'https://api.telegram.org';
/** Telegram captions are capped at 1024 chars; the rest is dropped, not rejected. */
const CAPTION_MAX = 1024;
const ALBUM_MAX = 10;

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

interface BotResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function callBot<T>(token: string, method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as BotResult<T> | null;
  if (!json || json.ok !== true) {
    const detail = json?.description ?? `HTTP ${res.status}`;
    throw new Error(`Telegram refused the post: ${detail}`);
  }
  return json.result as T;
}

/** Multipart upload — Telegram only accepts files via form-data, never JSON. */
async function callBotUpload<T>(
  token: string,
  method: string,
  fields: Record<string, string>,
  files: { name: string; filename: string; mime: string; bytes: Buffer }[],
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const f of files) {
    form.append(f.name, new Blob([new Uint8Array(f.bytes)], { type: f.mime }), f.filename);
  }
  const res = await fetch(`${API}/bot${token}/${method}`, { method: 'POST', body: form });
  const json = (await res.json().catch(() => null)) as BotResult<T> | null;
  if (!json || json.ok !== true) {
    const detail = json?.description ?? `HTTP ${res.status}`;
    throw new Error(`Telegram refused the media: ${detail}`);
  }
  return json.result as T;
}

function captionFor(b: Bundle): string {
  const text = (b.target.caption ?? b.post.body ?? '').trim();
  if (text.length > CAPTION_MAX) {
    warn(`telegram caption truncated from ${text.length} to ${CAPTION_MAX} chars`, { target: b.target.id });
    return text.slice(0, CAPTION_MAX - 1) + '…';
  }
  return text;
}

/** t.me deep link for a channel post (works for public @usernames). */
function postUrl(b: Bundle, messageId: number | string): string {
  const handle = (b.channel.metadata?.username as string | undefined) ?? '';
  const id = String(b.channel.external_id).replace(/^-100/, '');
  return handle ? `https://t.me/${handle.replace(/^@/, '')}/${messageId}` : `https://t.me/c/${id}/${messageId}`;
}

export async function publishTelegramTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  const chatId = String(b.channel.external_id ?? '').trim();
  if (!chatId) throw new Error('Telegram destination is missing — reconnect the channel in Connect.');
  if (!b.secrets.access_secret_id) {
    throw new Error('Telegram bot token is missing — reconnect the channel in Connect.');
  }
  const token = await readSecret(b.secrets.access_secret_id);
  if (!token) {
    throw new Error('Telegram bot token is missing — reconnect the channel in Connect.');
  }

  const media = [...(b.media ?? [])].sort((a, z) => a.position - z.position);
  const images = media.filter((m) => m.kind === 'image');
  const videos = media.filter((m) => m.kind === 'video');
  const caption = captionFor(b);

  // ---- text only ----
  if (media.length === 0) {
    const msg = await callBot<{ message_id: number }>(token, 'sendMessage', {
      chat_id: chatId,
      text: caption,
      disable_web_page_preview: false,
    });
    info('telegram text sent', { target: b.target.id, message: msg.message_id });
    return { remoteId: String(msg.message_id), remoteUrl: postUrl(b, msg.message_id) };
  }

  // ---- single video ----
  if (videos.length && media.length === 1) {
    const v = videos[0];
    const bytes = await storageDownload(await storageSign('post-media', v.storage_path), 200 * 1024 * 1024);
    const msg = await callBotUpload<{ message_id: number }>(
      token,
      'sendVideo',
      { chat_id: chatId, caption },
      [{ name: 'video', filename: 'video.mp4', mime: v.mime_type ?? 'video/mp4', bytes }],
    );
    info('telegram video sent', { target: b.target.id, message: msg.message_id });
    return { remoteId: String(msg.message_id), remoteUrl: postUrl(b, msg.message_id) };
  }

  // ---- album (sendMediaGroup hard-requires 2..10 items) ----
  const album = [...images, ...videos].slice(0, ALBUM_MAX).map((m, i) => ({
    kind: m.kind === 'video' ? 'video' : 'photo',
    media: m,
    name: `file${i}`,
    mime: m.mime_type ?? (m.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    filename: m.kind === 'video' ? `video${i}.mp4` : `photo${i}.jpg`,
  }));

  if (album.length >= 2) {
    const files: { name: string; filename: string; mime: string; bytes: Buffer }[] = [];
    for (const item of album) {
      const signed = await storageSign('post-media', item.media.storage_path);
      const bytes = await storageDownload(signed, 200 * 1024 * 1024);
      files.push({ name: item.name, filename: item.filename, mime: item.mime, bytes });
    }
    const payload = album.map((item, i) => ({
      type: item.kind,
      media: `attach://${item.name}`,
      ...(i === 0 && caption ? { caption } : {}),
    }));
    const msgs = await callBotUpload<{ message_id: number }[]>(
      token,
      'sendMediaGroup',
      { chat_id: chatId, media: JSON.stringify(payload) },
      files,
    );
    const first = msgs?.[0]?.message_id ?? 0;
    info('telegram album sent', { target: b.target.id, count: msgs?.length ?? 0 });
    return { remoteId: String(first), remoteUrl: postUrl(b, first) };
  }

  // ---- single image ----
  const img = album[0];
  const signed = await storageSign('post-media', img.media.storage_path);
  const bytes = await storageDownload(signed, 25 * 1024 * 1024);
  const msg = await callBotUpload<{ message_id: number }>(
    token,
    'sendPhoto',
    { chat_id: chatId, caption },
    [{ name: 'photo', filename: img.filename, mime: img.mime, bytes }],
  );
  info('telegram photo sent', { target: b.target.id, message: msg.message_id });
  return { remoteId: String(msg.message_id), remoteUrl: postUrl(b, msg.message_id) };
}

/**
 * Connect-time validation: getMe proves the token, getChat proves the bot can
 * see the destination (Telegram returns a readable error otherwise).
 */
export async function telegramResolveDestination(
  token: string,
  chatId: string,
): Promise<{ id: string; title: string; username: string }> {
  await callBot<{ id: number }>(token, 'getMe', {});
  const chat = await callBot<{ id: number; title?: string; username?: string; type: string }>(
    token,
    'getChat',
    { chat_id: chatId },
  );
  return {
    id: String(chat.id),
    title: chat.title ?? chat.username ?? chatId,
    username: chat.username ?? '',
  };
}
