import { createHash, randomBytes } from 'node:crypto';

/**
 * Workspace API key primitives (pure — no server imports, so vitest can
 * cover them). Format: `sos_live_<43 base64url chars>`. Only the SHA-256
 * hash is ever stored; the plaintext is shown once at creation.
 */

const PREFIX = 'sos_live_';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const secret = randomBytes(32).toString('base64url');
  const key = `${PREFIX}${secret}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, PREFIX.length + 8) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** `Authorization: Bearer <key>` → key, or null for any other scheme. */
export function bearerKey(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/** `api:<keyId>:<client-supplied>` namespaced idempotency client ids. */
export function apiClientId(keyId: string, idem: string): string {
  return `api:${keyId}:${idem}`;
}

export function isValidIdempotencyKey(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
}
