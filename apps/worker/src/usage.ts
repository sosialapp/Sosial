/**
 * Platform usage headers -> back off before the platform cuts us off.
 *
 * Meta (Facebook, Instagram, Threads) reports how much of a rolling window
 * the app and each Page/account have used (X-App-Usage, and
 * X-Business-Use-Case-Usage keyed by the business object). X reports
 * per-endpoint 15-minute windows (x-rate-limit-remaining / -reset). Nothing
 * read these before, so the first sign of trouble was a hard 429 or a
 * Meta "(#4) Application request limit reached" and a day of failures.
 *
 * Background reads (analytics, comment and DM sweeps) run inside
 * `runTracked`; every response they see goes through `noteResponse`. Once a
 * reading says "nearly full" or "limited", the job stops spending calls, the
 * channel gets `api_backoff_until`, and the schedulers skip it until then.
 * Publishing and user replies never run tracked, so they are never held back.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { MINUTE } from './cadence';

/** Back off once any window is this full (percent). */
export const SOFT_PCT = 80;
/** Hold background reads at least this long once limited. */
const MIN_HOLD = 5 * MINUTE;
const SOFT_HOLD = 30 * MINUTE;
const LIMITED_HOLD = 15 * MINUTE;
/** Never park a channel for more than a day on one reading. */
const MAX_HOLD = 24 * 60 * MINUTE;

/** Meta error codes that mean "throttled", whatever the HTTP status says. */
const META_THROTTLE_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80004, 80005, 80006, 80008]);

export interface HeaderLike {
  get(name: string): string | null;
}

export interface UsageReading {
  /** Fullest Meta window seen in this response (0-100+), null when absent. */
  pct: number | null;
  /** Meta's estimated_time_to_regain_access, in ms. */
  regainMs: number | null;
  /** X window reset / Retry-After, as an epoch ms. */
  resetAt: number | null;
  /** X calls left in the current window. */
  remaining: number | null;
  /** The platform refused this call for rate reasons. */
  limited: boolean;
}

const json = (raw: string | null): any => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const n = (v: unknown): number | null => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** Highest of call_count / total_cputime / total_time in one usage object. */
function fullest(o: any): number | null {
  if (!o || typeof o !== 'object') return null;
  const vals = [o.call_count, o.total_cputime, o.total_time, o.acc_id_util_pct].map(n).filter((v): v is number => v !== null);
  return vals.length ? Math.max(...vals) : null;
}

/** Read one response's usage signals. Pure; `body` is the parsed JSON when the caller has it. */
export function readUsage(status: number, headers: HeaderLike, body?: any, now = Date.now()): UsageReading {
  let pct: number | null = null;
  let regainMs: number | null = null;
  const bump = (v: number | null) => {
    if (v !== null) pct = pct === null ? v : Math.max(pct, v);
  };

  bump(fullest(json(headers.get('x-app-usage'))));
  const buc = json(headers.get('x-business-use-case-usage'));
  if (buc && typeof buc === 'object') {
    for (const rows of Object.values(buc)) {
      for (const row of Array.isArray(rows) ? rows : []) {
        bump(fullest(row));
        const regain = n((row as any)?.estimated_time_to_regain_access);
        if (regain !== null && regain > 0) regainMs = Math.max(regainMs ?? 0, regain * MINUTE);
      }
    }
  }

  const remaining = n(headers.get('x-rate-limit-remaining'));
  const reset = n(headers.get('x-rate-limit-reset'));
  let resetAt = reset !== null && reset > 0 ? reset * 1000 : null;
  const retryAfter = n(headers.get('retry-after'));
  if (retryAfter !== null && retryAfter > 0) resetAt = Math.max(resetAt ?? 0, now + retryAfter * 1000);

  const code = n(body?.error?.code);
  const limited = status === 429 || (code !== null && META_THROTTLE_CODES.has(code));
  return { pct, regainMs, resetAt, remaining, limited };
}

/**
 * Until when background reads should leave this channel alone, or null to
 * carry on. Pure, unit-tested.
 */
export function backoffUntil(r: UsageReading, now = Date.now()): number | null {
  const clamp = (t: number) => Math.min(now + MAX_HOLD, Math.max(now + MIN_HOLD, t));
  if (r.limited) {
    if (r.resetAt !== null && r.resetAt > now) return clamp(r.resetAt);
    if (r.regainMs !== null) return clamp(now + r.regainMs);
    return clamp(now + LIMITED_HOLD);
  }
  if (r.remaining !== null && r.remaining <= 0 && r.resetAt !== null && r.resetAt > now) return clamp(r.resetAt);
  if (r.pct !== null && r.pct >= SOFT_PCT) {
    return clamp(now + Math.max(r.regainMs ?? 0, SOFT_HOLD));
  }
  return null;
}

/* ------------------------------ job context ------------------------------ */

export class Tracker {
  /** Latest hold any response asked for (epoch ms). */
  until: number | null = null;
  reason: string | null = null;
  limited = false;

  observe(status: number, headers: HeaderLike, body?: any, now = Date.now()): void {
    const r = readUsage(status, headers, body, now);
    if (r.limited) this.limited = true;
    const t = backoffUntil(r, now);
    if (t !== null && (this.until === null || t > this.until)) {
      this.until = t;
      this.reason = r.limited ? `rate limited (HTTP ${status})` : r.pct !== null ? `usage at ${Math.round(r.pct)}%` : 'window used up';
    }
  }

  /** Stop spending calls in this job. */
  get spent(): boolean {
    return this.until !== null;
  }
}

const store = new AsyncLocalStorage<Tracker>();

/** Run a background job with usage tracking; the tracker says whether to hold the channel. */
export async function runTracked<T>(fn: () => Promise<T>): Promise<{ tracker: Tracker; result?: T; error?: unknown }> {
  const tracker = new Tracker();
  try {
    const result = await store.run(tracker, fn);
    return { tracker, result };
  } catch (error) {
    return { tracker, error };
  }
}

/** Record a platform response. A no-op outside tracked jobs. */
export function noteResponse(status: number, headers: HeaderLike, body?: any): void {
  store.getStore()?.observe(status, headers, body);
}

/** True inside a tracked (background) job. */
export function isBackground(): boolean {
  return store.getStore() !== undefined;
}

/** True once a tracked job has seen enough to stop calling the platform. */
export function budgetSpent(): boolean {
  return store.getStore()?.spent ?? false;
}

/** connected_channels.api_backoff_until still in the future. */
export function inBackoff(until: string | null | undefined, now = Date.now()): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > now;
}
