/**
 * How often a post is worth another platform read. Pure functions, no I/O,
 * so the schedule is unit-tested (cadence.test.ts) instead of discovered
 * against live rate limits.
 *
 * Engagement piles up in the first two days and then barely moves, so a
 * post is read on every analytics tick while it is young, then daily, then
 * weekly, and not at all after 30 days (the account's own post list, one
 * call for up to 50 posts, still catches an old post that takes off).
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Posts older than this are never read one by one again. */
export const STATS_MAX_AGE = 30 * DAY;

/** A tick that lands a few minutes early must not skip a whole cycle. */
const SLACK = 15 * MINUTE;

const ms = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/**
 * Minimum gap between per-post stats reads for a post of this age.
 * 0 = every analytics tick, null = stop reading it.
 */
export function statsEvery(ageMs: number): number | null {
  if (ageMs < 2 * DAY) return 0;
  if (ageMs < 7 * DAY) return DAY;
  if (ageMs < STATS_MAX_AGE) return 7 * DAY;
  return null;
}

/**
 * Is this post due for a stats read? `sentAt` unknown (old rows) reads as a
 * week-old post: daily at most, never on every tick.
 */
export function statsDue(sentAt: string | null | undefined, fetchedAt: string | null | undefined, now = Date.now()): boolean {
  const sent = ms(sentAt);
  const age = sent === null ? 7 * DAY - 1 : Math.max(0, now - sent);
  const every = statsEvery(age);
  if (every === null) return false;
  const fetched = ms(fetchedAt);
  if (fetched === null) return true;
  if (every === 0) return true;
  return now - fetched >= every - SLACK;
}

/**
 * Minimum gap between comment reads of one thread when the platform gives no
 * usable change signal (Threads only says "has replies"; Bluesky and Mastodon
 * count direct replies only, so a reply under a commenter never moves it).
 * null = leave it alone unless the count moves.
 */
export function threadEvery(ageMs: number): number | null {
  if (ageMs < 2 * DAY) return 30 * MINUTE;
  if (ageMs < 7 * DAY) return 6 * HOUR;
  if (ageMs < STATS_MAX_AGE) return DAY;
  return null;
}

export interface ThreadState {
  /** Comment count the platform reports now; null when this read didn't see the post. */
  count: number | null;
  /** Count stored after the last successful read of this thread. */
  storedCount: number | null;
  /** When the thread's comments were last read. */
  syncedAt: string | null;
  /** When the post went out (platform time, or Sosial's sent_at). */
  postedAt: string | null;
  /** True when the count includes replies to comments (Facebook stream,
   *  Instagram, YouTube), so an unchanged count means an unchanged thread. */
  countCoversReplies: boolean;
}

/** Should the sweep spend a platform read on this thread now? */
export function threadNeedsRead(s: ThreadState, now = Date.now()): boolean {
  const synced = ms(s.syncedAt);
  // A count that moved is always worth a read, including down (a deletion).
  if (s.count !== null && s.storedCount !== null && s.count !== s.storedCount) return true;
  if (synced === null) {
    // Never read: worth it when it has (or may have) comments.
    return s.count === null || s.count > 0;
  }
  if (s.count !== null && s.storedCount === null) return s.count > 0;
  if (s.count === 0) return false;
  if (s.countCoversReplies && s.count !== null) return false;
  // No reliable change signal: fall back to an age-based cadence.
  const posted = ms(s.postedAt);
  const every = threadEvery(posted === null ? 7 * DAY - 1 : Math.max(0, now - posted));
  if (every === null) return false;
  return now - synced >= every - Math.min(SLACK, every / 4);
}
