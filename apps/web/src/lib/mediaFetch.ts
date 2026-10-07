import { createHash } from 'node:crypto';

/**
 * Guarded media fetch shared by content-source imports (Notion, Sheets):
 * https only, no private/loopback hosts, streamed 25 MB cap, image/video
 * type allowlist, 30s timeout. Failures return {error} — callers flag the
 * row and continue, per the import contract.
 */

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?|172\.(1[6-9]|2\d|3[01])\.)/i;

export async function safeFetchFile(url: string): Promise<{ bytes: Uint8Array; mime: string; name: string } | { error: string }> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return { error: 'Media URL is not https.' };
    if (PRIVATE_HOST.test(u.hostname)) return { error: 'Media URL points at a private address.' };
    const res = await fetch(u, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
    if (!res.ok) return { error: `Media download failed (HTTP ${res.status}).` };
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!/^(image|video)\//.test(mime)) return { error: `Unsupported media type (${mime || 'unknown'}).` };
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_FILE_BYTES) return { error: 'Media file is larger than 25 MB.' };
    const reader = res.body?.getReader();
    if (!reader) return { error: 'Media download returned no data.' };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FILE_BYTES) {
        await reader.cancel();
        return { error: 'Media file is larger than 25 MB.' };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      bytes.set(c, off);
      off += c.byteLength;
    }
    const name = u.pathname.split('/').pop() || 'file';
    void createHash;
    return { bytes, mime, name };
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') return { error: 'Media download timed out.' };
    return { error: 'Media download failed.' };
  }
}
