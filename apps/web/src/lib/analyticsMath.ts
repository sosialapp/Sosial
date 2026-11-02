/**
 * Analytics math shared by web and mobile. Mirrored verbatim at
 * apps/web/src/lib/analyticsMath.ts and src/utils/analyticsMath.ts
 * (src/utils/analyticsMath.test.ts keeps the two identical), so both apps
 * bucket, sum and scale the same way and show the same numbers.
 *
 * Interactions are what the AUDIENCE did to OUR posts: reactions/likes,
 * comments received, shares (reposts AND quotes, which providers report inside
 * their share/repost counts) and saves/bookmarks. Link clicks are tracked and
 * shown as their own column, but they are NOT interactions. The worker strips
 * our own replies, self-likes and self-reposts before it writes post_stats
 * (apps/worker/src/stats.ts), so the plain sum below is the whole definition.
 */

export const DAY_MS = 86_400_000;

export interface EngagementCounts {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
}

export interface EngagementTotals {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  views: number | null;
}

const n0 = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Audience interactions on one stats row (or a summed total): reactions,
 *  comments, shares (reposts + quotes) and saves. Clicks are deliberately not
 *  part of it; they are shown separately. */
export function interactionsOf(s: EngagementCounts | null | undefined): number {
  if (!s) return 0;
  return n0(s.likes) + n0(s.comments) + n0(s.shares) + n0(s.saves);
}

export function emptyTotals(): EngagementTotals {
  return { likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: null };
}

/** Adds one post_stats row into a running total (views stay null until one is known). */
export function addStats(
  into: EngagementTotals,
  r: EngagementCounts & { views?: number | string | null },
): EngagementTotals {
  into.likes += n0(r.likes);
  into.comments += n0(r.comments);
  into.shares += n0(r.shares);
  into.saves += n0(r.saves);
  into.clicks += n0(r.clicks);
  if (r.views != null) into.views = (into.views ?? 0) + n0(r.views);
  return into;
}

/** Engagement rate in percent, null when there is no audience to divide by. */
export function engagementRate(interactions: number, followers: number | null): number | null {
  return followers && followers > 0 ? (interactions / followers) * 100 : null;
}

/* ------------------------------ calendar days ------------------------------ */

/** Local midnight of the day holding t. */
export function startOfLocalDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight n calendar days after the day holding t. Calendar maths, not
 *  n × 24h, so a DST switch never shifts a bucket by an hour into the wrong day. */
export function addLocalDays(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** A 'YYYY-MM-DD' capture date as that calendar day's local midnight. */
export function localDayOf(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return Number.NaN;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

export interface Bucket {
  /** Local midnight the bucket opens on. */
  start: number;
  /** Exclusive end (the next bucket's start). */
  end: number;
  value: number;
}

/**
 * Zero-filled buckets covering every calendar day from `from` to `to`
 * (inclusive, local time): one per day, one per 7 days once the range
 * passes ~2 months. Days with nothing in them stay 0, never interpolated.
 */
export function rangeBuckets(from: number, to: number): { buckets: Bucket[]; step: 1 | 7 } {
  const first = startOfLocalDay(from);
  const last = startOfLocalDay(to);
  let days = 0;
  while (addLocalDays(first, days) <= last) days += 1;
  const step: 1 | 7 = days > 62 ? 7 : 1;
  const buckets: Bucket[] = [];
  for (let i = 0; i < days; i += step) {
    const start = addLocalDays(first, i);
    // The last bucket stops at the range end, not 7 days later.
    const end = Math.min(addLocalDays(first, i + step), addLocalDays(last, 1));
    buckets.push({ start, end, value: 0 });
  }
  return { buckets, step };
}

/** Index of the bucket holding t, -1 when outside every bucket. */
export function bucketIndex(buckets: Bucket[], t: number): number {
  if (!Number.isFinite(t)) return -1;
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t < buckets[mid].start) hi = mid - 1;
    else if (t >= buckets[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Sums each event's value into the bucket its time falls in. */
export function fillBuckets(buckets: Bucket[], events: { at: number; value: number }[]): Bucket[] {
  const out = buckets.map((b) => ({ ...b, value: 0 }));
  for (const e of events) {
    const i = bucketIndex(out, e.at);
    if (i >= 0) out[i].value += e.value;
  }
  return out;
}

/**
 * Follower total per bucket: each channel's latest capture taken on or before
 * the bucket's last day, summed. A bucket before a channel's first capture
 * leaves that channel out; a bucket before ANY capture is null (unknown, drawn
 * as a gap), never back-filled with a later number.
 */
export function followerSeries(
  buckets: Bucket[],
  captures: { channel_id: string; at: number; followers: number | null }[],
): (number | null)[] {
  const perChannel = new Map<string, { at: number; v: number }[]>();
  for (const c of captures) {
    if (c.followers === null || !Number.isFinite(c.at)) continue;
    const arr = perChannel.get(c.channel_id) ?? [];
    arr.push({ at: c.at, v: c.followers });
    perChannel.set(c.channel_id, arr);
  }
  for (const arr of perChannel.values()) arr.sort((a, b) => a.at - b.at);
  return buckets.map((b) => {
    let total = 0;
    let known = false;
    for (const arr of perChannel.values()) {
      let v: number | null = null;
      for (const p of arr) {
        if (p.at < b.end) v = p.v;
        else break;
      }
      if (v !== null) {
        total += v;
        known = true;
      }
    }
    return known ? total : null;
  });
}

/** The last `weeks` 7-day windows ending today (local days), zero-filled. */
export function recentWeeks(now: number, times: number[], weeks = 8): Bucket[] {
  const end = addLocalDays(now, 1);
  const buckets: Bucket[] = [];
  for (let i = weeks; i >= 1; i--) {
    buckets.push({ start: addLocalDays(end, -7 * i), end: addLocalDays(end, -7 * (i - 1)), value: 0 });
  }
  return fillBuckets(buckets, times.map((at) => ({ at, value: 1 })));
}

/** Counts per local weekday, Sunday first (Date#getDay order). */
export function weekdayCounts(times: number[]): number[] {
  const out = new Array<number>(7).fill(0);
  for (const t of times) {
    if (!Number.isFinite(t)) continue;
    out[new Date(t).getDay()] += 1;
  }
  return out;
}

/* ---------------------------------- axis ---------------------------------- */

/**
 * A readable value axis from zero: the top is rounded up to 1, 2, 2.5 or 5 ×
 * 10^k so gridlines land on round numbers, and whole-number data never gets
 * fractional ticks.
 */
export function niceScale(maxValue: number, ticks = 4, integer = true): { max: number; ticks: number[] } {
  const hi = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  if (hi === 0) return { max: 1, ticks: [0, 1] };
  const raw = hi / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = mag * 10;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * mag >= raw) {
      step = m * mag;
      break;
    }
  }
  if (integer) step = Math.max(1, Math.ceil(step));
  const count = Math.max(1, Math.ceil(hi / step));
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(Number((i * step).toFixed(6)));
  return { max: out[out.length - 1], ticks: out };
}
