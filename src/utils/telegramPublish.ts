/**
 * Native Telegram publishing (Bot API). Mirrors apps/worker/src/telegram.ts:
 * text via sendMessage, single photo/video direct, 2–10 items via
 * sendMediaGroup with attach:// uploads.
 *
 * Multipart uploads go through XMLHttpRequest — expo/fetch (SDK 57) can't
 * serialize React Native {uri,name,type} FormData parts (see mastodonPublish).
 */

const API = 'https://api.telegram.org';
const CAPTION_MAX = 1024;
const ALBUM_MAX = 10;

interface BotResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

function botError(json: BotResult<unknown> | null, status: number, fallback: string): Error {
  const detail = json?.description ?? `HTTP ${status}`;
  return new Error(`Telegram refused the post: ${detail} (${fallback})`);
}

async function callBot<T>(token: string, method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as BotResult<T> | null;
  if (!json || json.ok !== true) throw botError(json, res.status, method);
  return json.result as T;
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
function xhrUpload<T>(
  token: string,
  method: string,
  fields: Record<string, string>,
  files: { name: string; uri: string; mime: string; filename: string }[],
  timeoutMs = 180000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    for (const f of files) form.append(f.name, { uri: f.uri, name: f.filename, type: f.mime } as any);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/bot${token}/${method}`);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      let j: BotResult<T> | null = null;
      try {
        j = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status < 200 || xhr.status >= 300 || !j || j.ok !== true) {
        return reject(botError(j, xhr.status, method));
      }
      resolve(j.result as T);
    };
    xhr.onerror = () => reject(new Error('Network request failed — check your connection.'));
    xhr.ontimeout = () => reject(new Error('Telegram upload timed out — try again.'));
    xhr.send(form as any);
  });
}

function fitCaption(t: string): string {
  const s = (t ?? '').trim();
  if (s.length <= CAPTION_MAX) return s;
  return s.slice(0, CAPTION_MAX - 1) + '…';
}

/**
 * Publish to a destination chat. Returns the message id for the queue.
 * Long text is truncated to Telegram's 1024-char media caption cap (the
 * composer warns at the same limit); albums cap at 10 items.
 */
export async function publishTelegram(opts: {
  botToken: string;
  chatId: string;
  text: string;
  imageUris?: string[];
  videoUri?: string;
}): Promise<string> {
  const { botToken, chatId } = opts;
  if (!botToken || !chatId) throw new Error('Telegram not connected');
  const caption = fitCaption(opts.text);
  const images = (opts.imageUris ?? []).filter(Boolean);
  const videoUri = opts.videoUri && opts.videoUri.trim() ? opts.videoUri : undefined;

  if (!caption && !videoUri && images.length === 0) {
    throw new Error('Write something or attach media — Telegram needs one of them.');
  }

  // Text only.
  if (!videoUri && images.length === 0) {
    const msg = await callBot<{ message_id: number }>(botToken, 'sendMessage', {
      chat_id: chatId,
      text: caption,
      disable_web_page_preview: false,
    });
    return String(msg.message_id);
  }

  // Single video.
  if (videoUri && images.length === 0) {
    const msg = await xhrUpload<{ message_id: number }>(
      botToken,
      'sendVideo',
      { chat_id: chatId, caption },
      [{ name: 'video', uri: videoUri, mime: mimeFor(videoUri, 'video'), filename: 'video.mp4' }],
    );
    return String(msg.message_id);
  }

  // Album (2..10) or single image.
  const items = [
    ...images.map((uri) => ({ uri, kind: 'image' as const })),
    ...(videoUri ? [{ uri: videoUri, kind: 'video' as const }] : []),
  ].slice(0, ALBUM_MAX);
  if (items.length >= 2) {
    const media = items.map((it, i) => ({
      type: it.kind === 'video' ? 'video' : 'photo',
      media: `attach://file${i}`,
      ...(i === 0 && caption ? { caption } : {}),
    }));
    const files = items.map((it, i) => ({
      name: `file${i}`,
      uri: it.uri,
      mime: mimeFor(it.uri, it.kind),
      filename: it.kind === 'video' ? `video${i}.mp4` : `photo${i}.jpg`,
    }));
    const msgs = await xhrUpload<{ message_id: number }[]>(botToken, 'sendMediaGroup', {
      chat_id: chatId,
      media: JSON.stringify(media),
    }, files);
    const first = msgs?.[0]?.message_id;
    if (!first) throw new Error('Telegram album failed.');
    return String(first);
  }

  const img = items[0];
  const msg = await xhrUpload<{ message_id: number }>(
    botToken,
    'sendPhoto',
    { chat_id: chatId, caption },
    [{ name: 'photo', uri: img.uri, mime: mimeFor(img.uri, 'image'), filename: 'photo.jpg' }],
  );
  return String(msg.message_id);
}
