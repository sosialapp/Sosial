/**
 * Native Discord publishing (bot token). Mirrors apps/worker/src/discord.ts:
 * text via JSON, files via multipart files[n]. Links auto-embed server-side.
 *
 * Multipart uploads go through XMLHttpRequest — expo/fetch (SDK 57) can't
 * serialize React Native {uri,name,type} FormData parts (see mastodonPublish).
 */

const API = 'https://discord.com/api/v10';
const CONTENT_MAX = 2000;
const MAX_FILES = 10;

interface DiscordMessage {
  id: string;
  channel_id: string;
}

function derr(json: { message?: string } | null, status: number): Error {
  const detail =
    json && typeof json.message === 'string' && json.message ? json.message : `HTTP ${status}`;
  return new Error(`Discord refused the post: ${detail}`);
}

async function callDiscord<T>(token: string, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') ?? '5');
    throw new Error(`Discord rate-limited this channel — retry in ${Math.ceil(retry)}s.`);
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !json) throw derr(json, res.status);
  return json;
}

function mimeFor(uri: string, kind: 'image' | 'video'): string {
  const u = uri.toLowerCase().split('?')[0];
  if (kind === 'video') {
    if (u.endsWith('.mov')) return 'video/quicktime';
    if (u.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/** Multipart upload via XHR (native file:// parts need the native module). */
function xhrMessage(
  token: string,
  channelId: string,
  payload: Record<string, unknown>,
  files: { uri: string; mime: string; filename: string }[],
  timeoutMs = 180000,
): Promise<DiscordMessage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    files.forEach((f, i) => {
      form.append(`files[${i}]`, { uri: f.uri, name: f.filename, type: f.mime } as any);
    });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/channels/${channelId}/messages`);
    xhr.setRequestHeader('Authorization', `Bot ${token}`);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      let j: any = null;
      try {
        j = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 429) {
        return reject(new Error('Discord rate-limited this channel — wait a few minutes and retry.'));
      }
      if (xhr.status < 200 || xhr.status >= 300 || !j?.id) {
        return reject(derr(j, xhr.status));
      }
      resolve(j as DiscordMessage);
    };
    xhr.onerror = () => reject(new Error('Network request failed — check your connection.'));
    xhr.ontimeout = () => reject(new Error('Discord upload timed out — try again.'));
    xhr.send(form as any);
  });
}

/**
 * Post a message to a channel. Returns the message id for the queue.
 * Over-long text throws (backend validation, never silent truncation).
 */
export async function publishDiscord(opts: {
  botToken: string;
  channelId: string;
  text: string;
  imageUris?: string[];
  videoUri?: string;
}): Promise<string> {
  const { botToken, channelId } = opts;
  if (!botToken || !channelId) throw new Error('Discord not connected');
  const text = (opts.text ?? '').trim();
  if (text.length > CONTENT_MAX) {
    throw new Error(
      `Discord messages cap at ${CONTENT_MAX} characters (this one is ${text.length}) — shorten the text.`,
    );
  }
  const files = [
    ...(opts.imageUris ?? []).filter(Boolean).map((uri) => ({ uri, kind: 'image' as const })),
    ...(opts.videoUri && opts.videoUri.trim() ? [{ uri: opts.videoUri, kind: 'video' as const }] : []),
  ].slice(0, MAX_FILES);

  if (!text && files.length === 0) {
    throw new Error('Write something or attach a file — Discord needs one of them.');
  }
  if (files.length === 0) {
    const msg = await callDiscord<DiscordMessage>(botToken, `/channels/${channelId}/messages`, {
      content: text,
      allowed_mentions: { parse: [] },
    });
    return msg.id;
  }
  const msg = await xhrMessage(
    botToken,
    channelId,
    { ...(text ? { content: text } : {}), allowed_mentions: { parse: [] } },
    files.map((f, i) => ({
      uri: f.uri,
      mime: mimeFor(f.uri, f.kind),
      filename: f.kind === 'video' ? `video${i}.mp4` : `photo${i}.jpg`,
    })),
  );
  return msg.id;
}
