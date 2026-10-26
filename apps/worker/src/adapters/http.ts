/** Shared HTTP helper for adapters: bounded retries with exponential
 *  backoff on 429/5xx and a per-provider rate budget (QPS governor). */
const QPS: Record<string, number> = {
  facebook: 5,
  instagram: 5,
  'threads': 5,
  x: 1.5,
  mastodon: 4,
  bluesky: 2,
  youtube: 2,
};

const lastCall = new Map<string, number>();

/** Hard per-request ceiling. Without it a silent TCP stall parks the job
 *  (and the whole claim loop) for minutes, which is what made Sync look
 *  broken: health checks queued behind hung provider calls. */
const TIMEOUT_MS =
  Number((globalThis as any)?.process?.env?.WORKER_HTTP_TIMEOUT_MS ?? 15000) || 15000;

async function respectBudget(provider: string): Promise<void> {
  const qps = QPS[provider] ?? 2;
  const minGap = 1000 / qps;
  for (;;) {
    const now = Date.now();
    const prev = lastCall.get(provider) ?? 0;
    const wait = Math.max(0, prev + minGap - now);
    if (wait <= 0) {
      lastCall.set(provider, now);
      return;
    }
    await new Promise((r) => setTimeout(r, wait));
  }
}

export class RateLimited extends Error {
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super('rate limited');
    this.retryAfter = retryAfter;
  }
}

export interface HttpOpts {
  provider: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  url: string;
  /** Extra platform name for plain-language errors. */
  label?: string;
}

/** fetch JSON with retries; returns { status, data }. */
export async function httpJson<T = any>(opts: HttpOpts, attempts = 3): Promise<{ status: number; data: T }> {
  const backoff = [0, 3000, 8000];
  let last: { status: number; data: T } | null = null;
  for (let i = 0; i < attempts; i++) {
    await respectBudget(opts.provider);
    let r: Response;
    try {
      r = await fetch(opts.url, {
        method: opts.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      if (i === attempts - 1) throw e instanceof Error ? e : new Error(String(e));
      await new Promise((r2) => setTimeout(r2, backoff[i] + 1500));
      continue;
    }
    let data: any = null;
    const text = await r.text().catch(() => '');
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    last = { status: r.status, data };
    if (r.status === 429) {
      const ra = Number(r.headers.get('retry-after') ?? 60);
      if (i === attempts - 1) throw new RateLimited(ra);
      // Cap the park: a provider can ask for an hour, but a job holding the
      // loop that long starves every other channel's sync.
      await new Promise((r2) => setTimeout(r2, Math.min(ra, 30) * 1000));
      continue;
    }
    if (r.status >= 500 && i < attempts - 1) {
      await new Promise((r2) => setTimeout(r2, backoff[i] + 1000));
      continue;
    }
    return { status: r.status, data };
  }
  return last as { status: number; data: T };
}

/** GET with query params. */
export function withParams(url: string, params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    q.set(k, String(v));
  }
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}${q.toString()}`;
}

/** Extraction-friendly error with a plain-language tail. */
export function httpError(label: string, data: any, status: number): Error {
  const msg =
    data?.error?.message ??
    data?.message ??
    data?.errors?.[0]?.message ??
    data?.error_description ??
    `request failed (${status})`;
  return new Error(`${label}: ${msg}`);
}
