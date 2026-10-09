/**
 * Direct PostgREST + Storage access with the service_role key (P6 grants).
 * Used for worker-owned writes the RPCs don't cover: token rotation updates
 * and private-bucket media downloads.
 */
import { required, env } from './env';
import { r2Configured, r2Key, r2Has, r2GetUrl, r2Remove, r2HeadSize, r2Stream, r2AbortMultipart } from './storage';

function base(): string {
  return required('WORKER_SUPABASE_URL').replace(/\/+$/, '');
}

/** Which store reads/deletes prefer. 'supabase' until R2 is provisioned; 'both'
 *  during the dual-write transition; 'r2' after the cutover. Supabase stays as
 *  a read fallback either way, so a legacy object never 404s. */
function storageBackend(): 'supabase' | 'r2' | 'both' {
  const v = env('STORAGE_BACKEND', 'supabase');
  return v === 'r2' || v === 'both' ? v : 'supabase';
}

function key(): string {
  return required('WORKER_SERVICE_ROLE_KEY');
}

async function fail(r: globalThis.Response, what: string): Promise<never> {
  const t = await r.text().catch(() => '');
  throw new Error(`${what} (${r.status}): ${t.slice(0, 200)}`);
}

/** PATCH one row by primary key (service_role bypasses RLS; P6 granted DML). */
export async function restPatch(table: string, id: string | number, body: Record<string, any>): Promise<void> {
  const r = await fetch(`${base()}/rest/v1/${table}?id=eq.${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) await fail(r, `patch ${table}`);
}

/** Short-lived download URL for a private-bucket object. Prefers R2 when the
 *  object is there; falls back to Supabase Storage for un-backfilled media. */
export async function storageSign(bucket: string, path: string, expiresIn = 300): Promise<string> {
  if (storageBackend() !== 'supabase' && r2Configured()) {
    const key = r2Key(bucket, path);
    if (await r2Has(key)) return r2GetUrl(key, expiresIn);
  }
  return supabaseSign(bucket, path, expiresIn);
}

async function supabaseSign(bucket: string, path: string, expiresIn = 300): Promise<string> {
  const r = await fetch(`${base()}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });
  if (!r.ok) await fail(r, 'storage sign');
  const j: any = await r.json().catch(() => ({}));
  const signed = String(j?.signedURL ?? '');
  if (!signed) throw new Error('storage sign returned no URL');
  return `${base()}/storage/v1${signed}`;
}

/** Delete one object from a bucket. During 'both' the object is removed from R2
 *  and Supabase; after cutover ('r2') only R2. Already-gone is success: the
 *  janitor only needs the object absent afterwards, so Storage's 400/404 both
 *  pass and R2's delete is idempotent. */
export async function storageRemove(bucket: string, path: string): Promise<void> {
  const pref = storageBackend();
  if (pref !== 'supabase' && r2Configured()) {
    await r2Remove(r2Key(bucket, path));
  }
  if (pref !== 'r2') {
    await supabaseRemove(bucket, path);
  }
}

async function supabaseRemove(bucket: string, path: string): Promise<void> {
  const r = await fetch(`${base()}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: 'DELETE',
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
    },
  });
  if (!r.ok && r.status !== 400 && r.status !== 404) await fail(r, 'storage remove');
}

/** Download bytes (default cap 25 MB — video channels pass a larger cap). */
export async function storageDownload(url: string, maxBytes = 25 * 1024 * 1024): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) await fail(r, 'media download');
  const ab = await r.arrayBuffer();
  if (ab.byteLength > maxBytes) {
    throw new Error(`media file over ${Math.round(maxBytes / 1048576)} MB`);
  }
  return Buffer.from(ab);
}

/** Object size in bytes, or null when absent. Prefers R2; falls back to a
 *  Supabase Storage HEAD (Content-Length) so legacy objects still report size. */
export async function storageHeadSize(bucket: string, path: string): Promise<number | null> {
  if (storageBackend() !== 'supabase' && r2Configured()) {
    const size = await r2HeadSize(r2Key(bucket, path));
    if (size !== null) return size;
  }
  const r = await fetch(`${base()}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: 'HEAD',
    headers: { apikey: key(), Authorization: `Bearer ${key()}` },
  });
  if (!r.ok) return null;
  const len = Number(r.headers.get('content-length') ?? 0);
  return Number.isFinite(len) && len > 0 ? len : null;
}

export interface ObjectStream {
  body: ReadableStream<Uint8Array>;
  /** Bytes this stream will deliver (the range length). */
  contentLength: number;
  /** Byte range served, when one was requested. */
  range?: { start: number; end: number };
  contentType?: string;
}

/** Stream a byte range of a private object without buffering — the path for
 *  multi-GB videos. R2 first (native ranged GET), else Supabase Storage (also
 *  supports the HTTP Range header). Returns null when the object is missing. */
export async function storageStream(
  bucket: string,
  path: string,
  range?: { start: number; end?: number },
): Promise<ObjectStream | null> {
  const rngHeader = range
    ? `bytes=${range.start}-${range.end === undefined ? '' : range.end}`
    : undefined;

  if (storageBackend() !== 'supabase' && r2Configured()) {
    const out = await r2Stream(r2Key(bucket, path), range);
    if (out) {
      return {
        body: out.body,
        contentLength: out.contentLength,
        range: out.range,
        contentType: out.contentType,
      };
    }
  }

  const r = await fetch(`${base()}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      ...(rngHeader ? { Range: rngHeader } : {}),
    },
  });
  if (!r.ok || !r.body) return null;
  const len = Number(r.headers.get('content-length') ?? 0);
  const cr = r.headers.get('content-range');
  let served: { start: number; end: number } | undefined;
  if (cr) {
    const m = /bytes\s+(\d+)-(\d+)\/\d+/.exec(cr);
    if (m) served = { start: Number(m[1]), end: Number(m[2]) };
  } else if (range) {
    served = { start: range.start, end: range.end ?? range.start + len - 1 };
  }
  return {
    body: r.body as ReadableStream<Uint8Array>,
    contentLength: Number.isFinite(len) ? len : 0,
    range: served,
    contentType: r.headers.get('content-type') ?? undefined,
  };
}

/** Abort an abandoned multipart upload for a private object (R2 only). */
export async function storageAbortMultipart(bucket: string, path: string, uploadId: string): Promise<void> {
  if (storageBackend() === 'supabase' || !r2Configured()) return;
  await r2AbortMultipart(r2Key(bucket, path), uploadId);
}

/**
 * Read a private object in fixed-size sequential chunks WITHOUT holding the
 * whole file in memory — the byte source for TikTok/X style chunked uploads.
 * Each chunk is a fully-materialised Buffer sized `chunkBytes` (the last one
 * may be shorter). `maxBytes` guards against runaway files; exceeded throws.
 */
export async function* storageChunks(
  bucket: string,
  path: string,
  chunkBytes: number,
  maxBytes = 10 * 1024 * 1024 * 1024,
): AsyncGenerator<Buffer> {
  let offset = 0;
  for (;;) {
    const stream = await storageStream(bucket, path, { start: offset, end: offset + chunkBytes - 1 });
    if (!stream) {
      if (offset === 0) throw new Error('media object not found in storage');
      return;
    }
    let served = 0;
    const reader = stream.body.getReader();
    const parts: Buffer[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(Buffer.from(value));
      served += value.byteLength;
      if (offset + served > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`media file over ${Math.round(maxBytes / 1048576)} MB`);
      }
    }
    await reader.cancel().catch(() => {});
    if (served === 0) return;
    yield Buffer.concat(parts);
    if (served < chunkBytes) return; // short read = end of object
    offset += served;
  }
}
