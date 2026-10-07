import { createHash } from 'node:crypto';

/**
 * Per-token rate limiting (in-process; serverless-safe enough for one region
 * — counts reset per isolate, which errs on the generous side rather than
 * blocking legitimate agents). Window: 60s. Writes are capped tighter than
 * reads. The counters are keyed by keyId only — never by content.
 */

const WINDOW_MS = 60_000;
const LIMITS = { read: 60, write: 20 } as const;

type Bucket = { windowStart: number; read: number; write: number };
const buckets = new Map<string, Bucket>();

function prune(now: number) {
  for (const [k, b] of buckets) {
    if (now - b.windowStart > WINDOW_MS) buckets.delete(k);
  }
}

export function mcpRate(_admin: unknown, keyId: string) {
  const idHash = createHash('sha256').update(keyId).digest('hex').slice(0, 16);
  return {
    take(tool: string, kind: 'read' | 'write'): { allowed: boolean; retryAfterSeconds: number } {
      const now = Date.now();
      prune(now);
      let b = buckets.get(idHash);
      if (!b || now - b.windowStart > WINDOW_MS) {
        b = { windowStart: now, read: 0, write: 0 };
        buckets.set(idHash, b);
      }
      const used = kind === 'write' ? b.write++ : b.read++;
      if (used >= LIMITS[kind]) {
        const retryAfterSeconds = Math.ceil((b.windowStart + WINDOW_MS - now) / 1000);
        return { allowed: false, retryAfterSeconds };
      }
      void tool;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
