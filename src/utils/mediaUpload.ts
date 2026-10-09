import { File, Paths, FileMode, UploadType } from 'expo-file-system';
import { callEdgeFunction } from './supabase';

/**
 * Direct-to-R2 media upload for the mobile app.
 *
 * Mirrors `apps/web/src/lib/mediaUpload.ts`: files never pass through the
 * Supabase/edge byte path (Hermes can't build Blobs, and Vercel caps bodies at
 * 4.5 MB). The edge `media` function only issues presigned URLs and owns the
 * `media_assets` row; the device PUTs bytes straight to R2 natively.
 *
 * Files ≤100 MB go up in a single PUT. Larger videos use S3 multipart: each
 * byte range is read with the native `File` handle into a temp cache file and
 * uploaded with a native PUT (no base64, no full-file buffering).
 */

const PART_CONCURRENCY = 2;
const PART_RETRIES = 3;

export interface UploadResult {
  mediaId: string;
  storagePath: string;
  thumbPath: string | null;
}

interface InitSingle {
  mediaId: string;
  key: string;
  upload: { mode: 'single'; url: string };
  thumbUpload: { key: string; url: string } | null;
}
interface InitMultipart {
  mediaId: string;
  key: string;
  upload: { mode: 'multipart'; uploadId: string; partSize: number; totalParts: number };
  thumbUpload: { key: string; url: string } | null;
}

function mimeFor(uri: string, kind: 'image' | 'video'): string {
  const u = uri.toLowerCase().split('?')[0];
  const ext = (u.match(/\.([a-z0-9]{2,4})$/) ?? [])[1] ?? '';
  if (kind === 'video') return ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function fileNameOf(uri: string, kind: 'image' | 'video'): string {
  const base = uri.split('?')[0].split('/').pop() ?? '';
  if (base && base.includes('.')) return base;
  return kind === 'video' ? 'upload.mp4' : 'upload.jpg';
}

/** PUT a whole file natively. `headers` must match what the edge signed. */
async function putFile(url: string, uri: string, headers?: Record<string, string>): Promise<string> {
  const res = await new File(uri).upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status}).`);
  return res.headers['ETag'] ?? res.headers['etag'] ?? '';
}

/** Read `[start, end)` into a temp file and PUT it; returns the part ETag. */
async function putPart(
  url: string,
  src: File,
  tmpName: string,
  start: number,
  end: number,
): Promise<string> {
  const handle = src.open(FileMode.ReadOnly);
  let bytes: Uint8Array;
  try {
    handle.offset = start;
    bytes = handle.readBytes(end - start);
  } finally {
    try {
      handle.close();
    } catch {}
  }
  const tmp = new File(Paths.cache, tmpName);
  try {
    if (tmp.exists) tmp.delete();
    tmp.create({ overwrite: true, intermediates: true });
    tmp.write(bytes);
    const res = await tmp.upload(url, {
      httpMethod: 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`Part upload failed (${res.status}).`);
    const etag = res.headers['ETag'] ?? res.headers['etag'] ?? '';
    if (!etag) throw new Error('Storage did not return a part ETag.');
    return etag;
  } finally {
    try {
      if (tmp.exists) tmp.delete();
    } catch {}
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export interface UploadOptions {
  kind: 'image' | 'video';
  width?: number;
  height?: number;
  durationMs?: number;
  /** Local file:// URI of a pre-generated WebP thumbnail (image uploads only). */
  thumbUri?: string;
  onProgress?: (fraction: number) => void;
  /** Acting user for service-role callers (unused on mobile). */
  actingUserId?: string;
}

/** Upload one local file straight to R2 and return the linked media id. */
export async function uploadMediaFromFile(
  workspaceId: string,
  uri: string,
  opts: UploadOptions,
): Promise<UploadResult> {
  const { kind } = opts;
  const src = new File(uri);
  const size = src.size;
  if (!size || size <= 0) throw new Error('Could not read the file size.');
  const name = fileNameOf(uri, kind);
  const mime = mimeFor(uri, kind);

  const init: InitSingle | InitMultipart = await callEdgeFunction('media', {
    action: 'init',
    workspaceId,
    userId: opts.actingUserId,
    kind,
    filename: name,
    mimeType: mime,
    size,
    width: opts.width,
    height: opts.height,
    durationMs: opts.durationMs,
    thumb: opts.thumbUri ? { filename: 'thumb.webp' } : undefined,
  });

  const storagePath = init.key.replace(/^post-media\//, '');

  try {
    if (init.upload.mode === 'single') {
      // Single PUT is signed WITH content-type, so it must be sent.
      await putFile(init.upload.url, uri, { 'Content-Type': mime });
      opts.onProgress?.(0.9);
    } else {
      const { partSize, totalParts } = init.upload;
      const parts = await mapLimit(
        Array.from({ length: totalParts }, (_, i) => i + 1),
        PART_CONCURRENCY,
        async (n, done) => {
          const start = (n - 1) * partSize;
          const end = Math.min(start + partSize, size);
          let lastErr: unknown;
          for (let attempt = 0; attempt < PART_RETRIES; attempt++) {
            try {
              const signed = await callEdgeFunction('media', {
                action: 'sign-parts',
                mediaId: init.mediaId,
                partNumbers: [n],
              });
              const url = String(signed?.urls?.[0]?.url ?? '');
              if (!url) throw new Error('No signed URL for part.');
              const etag = await putPart(url, src, `mp-${init.mediaId}-${n}`, start, end);
              opts.onProgress?.(0.9 * ((done + 1) / totalParts));
              return { partNumber: n, etag };
            } catch (e) {
              lastErr = e;
            }
          }
          throw lastErr instanceof Error ? lastErr : new Error(`Part ${n} failed.`);
        },
      );
      await callEdgeFunction('media', { action: 'complete', mediaId: init.mediaId, parts });
    }

    if (init.thumbUpload && opts.thumbUri) {
      // Thumb URL is signed with image/webp.
      await putFile(init.thumbUpload.url, opts.thumbUri, { 'Content-Type': 'image/webp' });
    }
    if (init.upload.mode === 'single') {
      await callEdgeFunction('media', { action: 'complete', mediaId: init.mediaId });
    }

    opts.onProgress?.(1);
    return {
      mediaId: init.mediaId,
      storagePath,
      thumbPath: init.thumbUpload ? init.thumbUpload.key : null,
    };
  } catch (e) {
    await callEdgeFunction('media', { action: 'abort', mediaId: init.mediaId }).catch(() => {});
    throw e instanceof Error ? e : new Error('Upload failed.');
  }
}
