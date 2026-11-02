import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE, statsDue, statsEvery, threadNeedsRead, type ThreadState } from './cadence';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('statsEvery', () => {
  it('reads young posts on every tick, then daily, weekly, then stops', () => {
    expect(statsEvery(1 * HOUR)).toBe(0);
    expect(statsEvery(47 * HOUR)).toBe(0);
    expect(statsEvery(3 * DAY)).toBe(DAY);
    expect(statsEvery(10 * DAY)).toBe(7 * DAY);
    expect(statsEvery(31 * DAY)).toBeNull();
  });
});

describe('statsDue', () => {
  it('always reads a post under 48 hours old', () => {
    expect(statsDue(ago(5 * HOUR), ago(10 * MINUTE), NOW)).toBe(true);
  });

  it('reads a never-fetched post younger than 30 days', () => {
    expect(statsDue(ago(20 * DAY), null, NOW)).toBe(true);
  });

  it('reads a 3-day-old post once a day, with slack for early ticks', () => {
    expect(statsDue(ago(3 * DAY), ago(6 * HOUR), NOW)).toBe(false);
    expect(statsDue(ago(3 * DAY), ago(DAY - 10 * MINUTE), NOW)).toBe(true);
  });

  it('reads a 2-week-old post weekly', () => {
    expect(statsDue(ago(14 * DAY), ago(3 * DAY), NOW)).toBe(false);
    expect(statsDue(ago(14 * DAY), ago(7 * DAY), NOW)).toBe(true);
  });

  it('never reads a post older than 30 days', () => {
    expect(statsDue(ago(31 * DAY), null, NOW)).toBe(false);
    expect(statsDue(ago(90 * DAY), ago(60 * DAY), NOW)).toBe(false);
  });

  it('treats an unknown sent time as a daily post, not an every-tick one', () => {
    expect(statsDue(null, ago(2 * HOUR), NOW)).toBe(false);
    expect(statsDue(null, ago(DAY), NOW)).toBe(true);
    expect(statsDue(null, null, NOW)).toBe(true);
  });
});

describe('threadNeedsRead', () => {
  const base: ThreadState = {
    count: 3,
    storedCount: 3,
    syncedAt: ago(10 * MINUTE),
    postedAt: ago(1 * HOUR),
    countCoversReplies: true,
  };

  it('skips an unchanged thread when the count covers replies', () => {
    expect(threadNeedsRead(base, NOW)).toBe(false);
    expect(threadNeedsRead({ ...base, syncedAt: ago(20 * DAY) }, NOW)).toBe(false);
  });

  it('reads when the count moves, up or down', () => {
    expect(threadNeedsRead({ ...base, count: 4 }, NOW)).toBe(true);
    expect(threadNeedsRead({ ...base, count: 2 }, NOW)).toBe(true);
  });

  it('reads a thread never read before only when it may have comments', () => {
    expect(threadNeedsRead({ ...base, storedCount: null, syncedAt: null }, NOW)).toBe(true);
    expect(threadNeedsRead({ ...base, count: 0, storedCount: null, syncedAt: null }, NOW)).toBe(false);
    expect(threadNeedsRead({ ...base, count: null, storedCount: null, syncedAt: null }, NOW)).toBe(true);
  });

  it('skips posts with no comments', () => {
    expect(threadNeedsRead({ ...base, count: 0, storedCount: 0, syncedAt: ago(5 * DAY) }, NOW)).toBe(false);
  });

  it('falls back to an age-based cadence without a reliable count', () => {
    const loose = { ...base, countCoversReplies: false };
    // young post: every 30 minutes
    expect(threadNeedsRead({ ...loose, syncedAt: ago(10 * MINUTE) }, NOW)).toBe(false);
    expect(threadNeedsRead({ ...loose, syncedAt: ago(30 * MINUTE) }, NOW)).toBe(true);
    // 3 days old: every 6 hours
    expect(threadNeedsRead({ ...loose, postedAt: ago(3 * DAY), syncedAt: ago(2 * HOUR) }, NOW)).toBe(false);
    expect(threadNeedsRead({ ...loose, postedAt: ago(3 * DAY), syncedAt: ago(6 * HOUR) }, NOW)).toBe(true);
    // older than 30 days: only when the count moves
    expect(threadNeedsRead({ ...loose, postedAt: ago(40 * DAY), syncedAt: ago(10 * DAY) }, NOW)).toBe(false);
    expect(threadNeedsRead({ ...loose, postedAt: ago(40 * DAY), count: 5 }, NOW)).toBe(true);
  });

  it('reads a post the list did not cover on the age cadence', () => {
    const unseen = { ...base, count: null, storedCount: 2, postedAt: ago(10 * DAY) };
    expect(threadNeedsRead({ ...unseen, syncedAt: ago(2 * HOUR) }, NOW)).toBe(false);
    expect(threadNeedsRead({ ...unseen, syncedAt: ago(DAY) }, NOW)).toBe(true);
  });
});
