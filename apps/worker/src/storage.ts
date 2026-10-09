/**
 * Cloudflare R2 (S3-compatible) media store — the zero-egress replacement for
 * Supabase Storage. Objects live in ONE bucket (`R2_BUCKET`, default
 * `sosial-media`) under prefixes that mirror the old bucket names:
 *   post-media/<storage_path>   (private — presigned GET/PUT)
 *   blog-media/<path>           (public — R2_PUBLIC_URL)
 *
 * The switch is env-driven (`STORAGE_BACKEND`) so it ships safely before the
 * backfill is done: reads prefer R2 when the object is present and fall back to
 * Supabase Storage, which stays read-only until the cutover is complete.
 */
import { S3Client, HeadObjectCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

let client: S3Client | null = null;
let bucketName = 'sosial-media';

/** True when every R2 credential the worker needs is present. */
export function r2Configured(): boolean {
  return Boolean(env('R2_ACCOUNT_ID') && env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY'));
}

function r2(): S3Client {
  if (!client) {
    bucketName = env('R2_BUCKET', 'sosial-media');
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env('R2_ACCESS_KEY_ID'),
        secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      },
    });
  }
  return client;
}

/** Logical bucket + path → R2 object key (prefix mirrors the old bucket). */
export function r2Key(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

/** Public URL for a public-prefix object (blog media, thumbnails). */
export function r2PublicUrl(key: string): string {
  const base = env('R2_PUBLIC_URL').replace(/\/+$/, '');
  return base ? `${base}/${key}` : '';
}

// HEAD results are memoised per process: the worker is long-running and publish
// asks for the same asset across retries. Capped so a huge run cannot leak.
const known = new Map<string, boolean>();
const KNOWN_MAX = 10_000;

/** Does the object exist in R2? (cached; false on any error, incl. missing). */
export async function r2Has(key: string): Promise<boolean> {
  const cached = known.get(key);
  if (cached !== undefined) return cached;
  let exists = false;
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    exists = true;
  } catch {
    exists = false;
  }
  if (known.size >= KNOWN_MAX) known.clear();
  known.set(key, exists);
  return exists;
}

/** Presigned PUT for a direct browser/native upload. */
export function r2PutUrl(key: string, contentType: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

/** Presigned GET for a private object. */
export function r2GetUrl(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn });
}

/** Delete an object. R2 treats a missing key as success, so this is idempotent. */
export async function r2Remove(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
}

/** Size of an object in bytes, or null when it isn't there. Also warms the
 *  existence cache so a following r2Has() doesn't re-HEAD. */
export async function r2HeadSize(key: string): Promise<number | null> {
  try {
    const head = await r2().send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    if (known.size >= KNOWN_MAX) known.clear();
    known.set(key, true);
    return typeof head.ContentLength === 'number' ? head.ContentLength : null;
  } catch {
    if (known.size >= KNOWN_MAX) known.clear();
    known.set(key, false);
    return null;
  }
}

export interface R2ObjectStream {
  /** Body stream for the requested range (or the whole object). */
  body: ReadableStream<Uint8Array>;
  /** Bytes delivered by this stream (the range length, or the full size). */
  contentLength: number;
  /** Total object size when known (from ContentRange on a ranged GET). */
  totalSize?: number;
  /** Byte range actually returned, when the caller asked for one. */
  range?: { start: number; end: number };
  contentType?: string;
}

/** Open a byte range of a private object as a stream — the publishing path for
 *  large videos. `end` is inclusive (S3/R2 semantics). Never buffers. */
export async function r2Stream(
  key: string,
  range?: { start: number; end?: number },
): Promise<R2ObjectStream | null> {
  const Range = range
    ? `bytes=${Math.max(0, Math.floor(range.start))}-${range.end === undefined ? '' : Math.floor(range.end)}`
    : undefined;
  try {
    const out = await r2().send(new GetObjectCommand({ Bucket: bucketName, Key: key, Range }));
    if (!out.Body) return null;
    const contentLength = out.ContentLength ?? 0;
    let totalSize: number | undefined;
    const cr = out.ContentRange;
    if (cr) {
      const m = /bytes\s+\d+-\d+\/(\d+)/.exec(cr);
      if (m) totalSize = Number(m[1]);
    }
    return {
      body: out.Body as ReadableStream<Uint8Array>,
      contentLength,
      totalSize: totalSize ?? (range ? undefined : contentLength),
      range: range
        ? { start: range.start, end: range.end ?? range.start + contentLength - 1 }
        : undefined,
      contentType: out.ContentType,
    };
  } catch {
    return null;
  }
}

/** Abort a stray multipart upload (used to reclaim parts from failed sessions). */
export async function r2AbortMultipart(key: string, uploadId: string): Promise<void> {
  try {
    await r2().send(new AbortMultipartUploadCommand({ Bucket: bucketName, Key: key, UploadId: uploadId }));
  } catch {
    // Best-effort: an already-aborted or completed upload is fine.
  }
}
