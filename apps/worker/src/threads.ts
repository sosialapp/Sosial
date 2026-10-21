/**
 * Threads publish adapter (Wave A). Ports publishThreads from
 * src/utils/metaPublish.ts: container → publish. Single attachment
 * (first wins), 500-char text cap, topic_tag from target options.
 * Media goes by signed Storage URL (Threads fetches it server-side).
 * Threads only pulls JPEG and PNG images — anything else (WebP, HEIC,
 * GIF, AVIF) is transcoded to JPEG first, otherwise Meta rejects the
 * container with "unsupported image format".
 */
import { readSecret, markTargetProgress } from './db';
import { storageSign, storageDownload } from './rest';
import { r2PutObject, r2Remove } from './storage';
import { info, debug } from './logger';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

const THREADS_API = 'https://graph.threads.net';

interface Bundle {
  target: {
    id: string;
    provider: string;
    caption: string | null;
    options: any;
    status: string;
    remote_id?: string | null;
    remote_url?: string | null;
  };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: any };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

function gerr(j: any, fallback: string, step: string): string {
  const e = j?.error;
  const m = typeof e?.message === 'string' && e.message ? e.message : fallback;
  const sub = e?.error_subcode ? ` subcode ${e.error_subcode}` : '';
  const code = e?.code ? ` (code ${e.code}${sub})` : sub;
  return `[${step}] ${m}${code}`;
}

const cap = (t: string, max: number): string => (t.length > max ? t.slice(0, max - 1) + '…' : t);

/** Threads pulls only JPEG/PNG. Anything else is transcoded to JPEG and
 *  parked under post-media/converted/ (the signed URL outlives the publish;
 *  the scratch object is removed best-effort once the container finishes). */
async function threadsImageUrl(m: { storage_path: string; mime_type: string | null }): Promise<{ url: string; scratchKey?: string }> {
  const mime = (m.mime_type ?? '').toLowerCase();
  const ext = m.storage_path.toLowerCase().split('?')[0].split('.').pop() ?? '';
  const ok =
    mime === 'image/jpeg' || mime === 'image/png' ||
    (!mime && (ext === 'jpg' || ext === 'jpeg' || ext === 'png'));
  if (ok) return { url: await storageSign('post-media', m.storage_path, 3600) };
  // Pull the bytes through the backend abstraction (R2 first, Supabase
  // Storage fallback), re-encode, park, sign.
  const signed = await storageSign('post-media', m.storage_path, 600);
  const buf = await storageDownload(signed);
  const jpg = await sharp(buf).rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
  const key = `converted/${randomUUID()}.jpg`;
  await r2PutObject(key, jpg, 'image/jpeg');
  info(`threads: transcoded ${m.storage_path} (${mime || ext || 'unknown'}) to JPEG for publish`);
  return { url: await storageSign('post-media', key, 3600), scratchKey: key };
}

interface OnePost {
  threadsId: string;
  token: string;
  text: string;
  mediaUrl?: string;
  kind: 'TEXT' | 'IMAGE' | 'VIDEO';
  topicTag?: string;
  replyToId?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Container → wait FINISHED → publish. Returns the created post id. */
async function publishOne(a: OnePost): Promise<string> {
  const tok = encodeURIComponent(a.token);
  const params =
    `media_type=${a.kind}&text=${encodeURIComponent(a.text)}` +
    (a.kind === 'IMAGE' && a.mediaUrl ? `&image_url=${encodeURIComponent(a.mediaUrl)}` : '') +
    (a.kind === 'VIDEO' && a.mediaUrl ? `&video_url=${encodeURIComponent(a.mediaUrl)}` : '') +
    (a.topicTag ? `&topic_tag=${encodeURIComponent(a.topicTag)}` : '') +
    (a.replyToId ? `&reply_to_id=${encodeURIComponent(a.replyToId)}` : '') +
    `&access_token=${tok}`;

  // Container creation. Meta intermittently answers code 100 subcode 33
  // ("object does not exist / missing permissions") for perfectly healthy
  // accounts — their own forum confirms the same call succeeds on retry, the
  // persistent case is a stale connection and the fix is a reconnect.
  let cj: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const c = await fetch(`${THREADS_API}/v1.0/${a.threadsId}/threads?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${a.token}` },
    });
    cj = await c.json().catch(() => ({}));
    if (c.status === 401) throw new Error('Threads session expired, toggle cloud publishing off and on in Connect to refresh.');
    if (cj?.error?.code === 100 && cj?.error?.error_subcode === 33 && attempt < 2) {
      await sleep(attempt === 0 ? 5000 : 15000);
      continue;
    }
    break;
  }
  if (cj?.error || !cj?.id) {
    const raw = gerr(cj, 'Threads container failed', 'container');
    if (cj?.error?.code === 100 && cj?.error?.error_subcode === 33) {
      throw new Error(
        'Threads rejected the container (code 100 subcode 33) — a Meta-side glitch or a stale connection. It usually clears on retry; if it keeps failing, disconnect and reconnect Threads in Connect. ' +
          raw,
      );
    }
    throw new Error(raw);
  }
  const creationId = String(cj.id);

  // The container must reach FINISHED before publishing, firing
  // threads_publish immediately races Meta's backend (code 24, subcode
  // 4279009). Poll status, bounded. A 100/33 on this READ is a known
  // Meta-side glitch on freshly created objects (it fails even though the
  // container exists — see the Postiz #1562 write-up for the same bug on
  // Instagram): treat it as "still processing" and keep polling.
  const start = Date.now();
  for (;;) {
    const s = await fetch(
      `${THREADS_API}/v1.0/${encodeURIComponent(creationId)}?fields=status&access_token=${tok}`,
    );
    const sj: any = await s.json().catch(() => ({}));
    const status = String(sj?.status ?? '').toUpperCase();
    if (status === 'FINISHED') break;
    if (status === 'ERROR') {
      throw new Error(gerr(sj, 'Threads container processing failed', `status:${creationId}`));
    }
    const read33 = sj?.error?.code === 100 && sj?.error?.error_subcode === 33;
    if (!read33 && Date.now() - start > 90000) {
      throw new Error(`Threads container not ready after 90s (${status || 'unknown'}), retry shortly.`);
    }
    await sleep(4000);
  }

  // threads_publish. Same 100/33 transient can hit the POST on a fresh
  // container; one bounded retry before giving up.
  let pj: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = await fetch(
      `${THREADS_API}/v1.0/${a.threadsId}/threads_publish?creation_id=${encodeURIComponent(creationId)}&access_token=${tok}`,
      { method: 'POST', headers: { Authorization: `Bearer ${a.token}` } },
    );
    pj = await p.json().catch(() => ({}));
    if (p.status === 401) throw new Error('Threads session expired, toggle cloud publishing off and on in Connect to refresh.');
    if (pj?.error?.code === 100 && pj?.error?.error_subcode === 33 && attempt === 0) {
      await sleep(5000);
      continue;
    }
    break;
  }
  if (pj.error || !pj.id) throw new Error(gerr(pj, 'Threads publish failed', `publish:${creationId}`));
  return String(pj.id);
}

export async function publishThreadsTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle as Bundle;
  const threadsId = b.channel.external_id;
  if (!threadsId) throw new Error('Threads channel missing user ID, re-enable cloud publishing.');
  if (!b.secrets.access_secret_id) throw new Error('Threads token missing, re-enable cloud publishing.');
  const token = await readSecret(b.secrets.access_secret_id);
  if (!token) throw new Error('Threads session expired, toggle cloud publishing off and on in Connect to refresh.');

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  const first = (b.media ?? [])
    .filter((m) => m.kind === 'image' || m.kind === 'video')
    .sort((a, z) => a.position - z.position)[0];
  const kind = !first ? 'TEXT' : first.kind === 'video' ? 'VIDEO' : 'IMAGE';
  let mediaUrl = '';
  let scratchKey: string | undefined;
  if (first && kind === 'IMAGE') {
    // Threads only pulls JPEG/PNG; transcode anything else up front.
    const img = await threadsImageUrl(first);
    mediaUrl = img.url;
    scratchKey = img.scratchKey;
  } else if (first) {
    // Threads pulls the video file itself, signed URL works (bearer URL, 1h).
    mediaUrl = await storageSign('post-media', first.storage_path, 3600);
  }
  const tag = String(b.target.options?.threadsTopic ?? '')
    .replace(/^[#\s]+/, '')
    .replace(/[.&]/g, '')
    .trim()
    .slice(0, 50);

  // Manual/auto thread segments from the app. Head carries media + topic tag;
  // replies are text-only and chain via reply_to_id.
  const segments = ((b.target.options?.thread as string[] | undefined) ?? [])
    .map((s) => (s ?? '').trim())
    .filter(Boolean);

  // Resume: a previous attempt already created the head post and recorded its
  // id. Re-publishing would duplicate the thread, so continue from there (or
  // settle a single-post target that is in fact complete).
  const progressUrl = (id: string): string => `https://www.threads.net/post/${id}`;
  const resumeId = String(b.target.remote_id ?? '').trim();
  if (resumeId) {
    if (segments.length <= 1) {
      info(`threads target ${b.target.id}: already published ${resumeId}, settling`);
      return { remoteId: resumeId, remoteUrl: progressUrl(resumeId) };
    }
    info(`threads target ${b.target.id}: resuming THREAD ${segments.length} from ${resumeId}`);
    let parent = resumeId;
    for (let i = 1; i < segments.length; i++) {
      parent = await publishOne({
        threadsId,
        token,
        text: cap(segments[i], 500),
        kind: 'TEXT',
        replyToId: parent,
      });
    }
    return { remoteId: resumeId, remoteUrl: progressUrl(resumeId) };
  }

  let remoteId = '';
  if (segments.length > 1) {
    info(`threads target ${b.target.id}: THREAD ${segments.length}`);
    let parent: string | undefined;
    for (let i = 0; i < segments.length; i++) {
      const id = await publishOne({
        threadsId,
        token,
        text: cap(segments[i], 500),
        mediaUrl: i === 0 ? mediaUrl : undefined,
        kind: i === 0 ? kind : 'TEXT',
        topicTag: i === 0 ? tag || undefined : undefined,
        replyToId: parent,
      });
      if (i === 0) {
        remoteId = id;
        // Record the head immediately so a mid-thread failure resumes here.
        await markTargetProgress(b.target.id, id, progressUrl(id)).catch((e) =>
          debug(`threads target ${b.target.id}: progress write failed: ${String(e)}`),
        );
      }
      parent = id;
    }
  } else {
    info(`threads target ${b.target.id}: ${kind}${tag ? ` #${tag}` : ''}`);
    remoteId = await publishOne({
      threadsId,
      token,
      text: cap(text, 500),
      mediaUrl,
      kind,
      topicTag: tag || undefined,
    });
    await markTargetProgress(b.target.id, remoteId, progressUrl(remoteId)).catch((e) =>
      debug(`threads target ${b.target.id}: progress write failed: ${String(e)}`),
    );
  }
  // The container reached FINISHED inside publishOne, meaning Meta has
  // pulled the image bytes; the transcoded scratch copy can go.
  if (scratchKey) await r2Remove(scratchKey).catch((e) => debug(`threads scratch cleanup: ${String(e)}`));
  return { remoteId, remoteUrl: progressUrl(remoteId) };
}
