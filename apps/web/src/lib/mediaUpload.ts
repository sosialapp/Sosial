/**
 * Direct-to-R2 media upload for the web app.
 *
 * Bytes never touch Vercel (4.5 MB body limit) or Supabase: the browser talks
 * to Cloudflare R2 through short-lived presigned URLs minted by the `media`
 * edge function. Files ≤100 MB go up in a single PUT; larger videos use S3
 * multipart with bounded concurrency and per-part retries.
 *
 * Images also get a client-generated WebP thumbnail (≤640 px) uploaded to the
 * asset's `thumb_path`, so grids never download the full-size original.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from './mediaLimits';

const MULTIPART_OVER = 100 * 1024 * 1024;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const THUMB_MAX_EDGE = 640;

export interface UploadResult {
  mediaId: string;
  storagePath: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

interface InitResponse {
  mediaId: string;
  key: string;
  upload:
    | { mode: 'single'; url: string }
    | { mode: 'multipart'; uploadId: string; partSize: number; totalParts: number };
  thumbUpload: { key: string; url: string } | null;
}

async function invoke<T>(sb: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke('media', { body });
  if (error) {
    // functions.invoke surfaces non-2xx in `data.error` too.
    const msg = (data as { error?: string } | null)?.error ?? error.message;
    throw new Error(msg || 'Media request failed.');
  }
  const err = (data as { error?: string } | null)?.error;
  if (err) throw new Error(err);
  return data as T;
}

/** Probe intrinsic image size and (optionally) draw a downscaled WebP thumb. */
async function loadImage(file: File): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { bitmap: bmp, width: bmp.width, height: bmp.height };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('image decode failed'));
      el.src = url;
    });
    return { bitmap: img, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Canvas → WebP blob at ≤THUMB_MAX_EDGE on the long edge. */
async function makeThumb(file: File): Promise<{ blob: Blob; width: number; height: number } | null> {
  const loaded = await loadImage(file);
  if (!loaded) return null;
  const { bitmap, width, height } = loaded;
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(width, height));
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, tw, th);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.72));
  if (!blob) return null;
  return { blob, width, height };
}

/** Read intrinsic dimensions without producing a thumbnail (videos). */
async function probeVideo(file: File): Promise<{ width: number | null; height: number | null; durationMs: number | null }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () =>
        res({
          width: v.videoWidth || null,
          height: v.videoHeight || null,
          durationMs: Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : null,
        });
      v.onerror = () => res({ width: null, height: null, durationMs: null });
      v.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** PUT with retries; returns the ETag (needed to complete a multipart upload).
 *  `contentType` must be sent on single PUTs because the edge signs it. */
async function putWithRetry(url: string, body: Blob, etagNeeded: boolean, contentType?: string): Promise<string | null> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'PUT',
        body,
        headers: contentType ? { 'Content-Type': contentType } : undefined,
      });
      if (!r.ok) throw new Error(`upload part failed (${r.status})`);
      return etagNeeded ? (r.headers.get('etag') ?? null) : null;
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('upload failed');
}

/** Bounded-concurrency map. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Upload one file to R2. Files ≤100 MB use a single PUT; larger videos use
 * multipart. Images get a WebP thumbnail. Returns the created asset details.
 */
export async function uploadMedia(
  sb: SupabaseClient,
  workspaceId: string,
  file: File,
  kind: 'image' | 'video',
  onProgress?: (fraction: number) => void,
  /** Set when called with the service_role client (public API route); names the
   *  acting user so the edge can authorize without a user JWT. */
  actingUserId?: string,
): Promise<UploadResult> {
  if (kind === 'image' && file.size > IMAGE_MAX_BYTES) throw new Error(`${file.name} is over 10 MB.`);
  if (kind === 'video' && file.size > VIDEO_MAX_BYTES) throw new Error(`${file.name} is over 10 GB.`);

  // Client-side metadata + thumbnail before we open the session.
  let thumb: { blob: Blob; width: number; height: number } | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let durationMs: number | null = null;
  if (kind === 'image') {
    thumb = await makeThumb(file).catch(() => null);
    if (thumb) {
      width = thumb.width;
      height = thumb.height;
    }
  } else {
    const probe = await probeVideo(file).catch(() => ({ width: null, height: null, durationMs: null }));
    width = probe.width;
    height = probe.height;
    durationMs = probe.durationMs;
  }

  const init = await invoke<InitResponse>(sb, {
    action: 'init',
    workspaceId,
    userId: actingUserId,
    kind,
    filename: file.name,
    size: file.size,
    mimeType: file.type || undefined,
    width: width ?? undefined,
    height: height ?? undefined,
    durationMs: durationMs ?? undefined,
    thumb: thumb ? { filename: 'thumb.webp', size: thumb.blob.size, mimeType: 'image/webp' } : undefined,
  });

  try {
    if (init.upload.mode === 'single') {
      await putWithRetry(init.upload.url, file, false, file.type || 'application/octet-stream');
      onProgress?.(0.95);
    } else {
      const { partSize, totalParts } = init.upload;
      const parts = await mapLimit(Array.from({ length: totalParts }, (_, i) => i + 1), CONCURRENCY, async (partNumber, done) => {
        const start = (partNumber - 1) * partSize;
        const end = Math.min(file.size, start + partSize);
        const chunk = file.slice(start, end);
        const { urls } = await invoke<{ urls: { partNumber: number; url: string }[] }>(sb, {
          action: 'sign-parts',
          mediaId: init.mediaId,
          partNumbers: [partNumber],
        });
        const etag = await putWithRetry(urls[0].url, chunk, true);
        if (!etag) throw new Error('part upload returned no ETag');
        onProgress?.((done + 1) / totalParts);
        return { partNumber, etag };
      });
      await invoke(sb, { action: 'complete', mediaId: init.mediaId, parts });
    }

    if (thumb && init.thumbUpload) {
      await putWithRetry(init.thumbUpload.url, thumb.blob, false, 'image/webp').catch(() => null);
    }

    if (init.upload.mode === 'single') {
      await invoke(sb, { action: 'complete', mediaId: init.mediaId });
    }
    onProgress?.(1);
    return {
      mediaId: init.mediaId,
      storagePath: init.key.replace(/^post-media\//, ''),
      thumbPath: init.thumbUpload?.key ?? null,
      width,
      height,
      durationMs,
    };
  } catch (e) {
    await invoke(sb, { action: 'abort', mediaId: init.mediaId }).catch(() => {});
    throw e instanceof Error ? e : new Error('Upload failed.');
  }
}

/**
 * Upload a public blog asset (cover, inline image, doc image) to the public
 * `blog-media/` R2 prefix and return its public URL. App-admin only — the edge
 * enforces it. `path` is the prefix (e.g. `covers`).
 */
export async function uploadBlogMedia(sb: SupabaseClient, path: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `${path.replace(/^\/+|\/+$/g, '')}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const contentType = file.type || 'application/octet-stream';
  const { data, error } = await sb.functions.invoke('media', {
    body: { action: 'put', bucket: 'blog-media', path: key, contentType },
  });
  if (error) throw new Error(error.message || 'Blog media request failed.');
  const url = (data as { url?: string; error?: string } | null)?.url;
  if (!url) throw new Error((data as { error?: string } | null)?.error || 'Blog media request failed.');
  await putWithRetry(url, file, false, contentType);
  const pub = await invoke<{ url: string }>(sb, { action: 'public', bucket: 'blog-media', path: key });
  return pub.url;
}
