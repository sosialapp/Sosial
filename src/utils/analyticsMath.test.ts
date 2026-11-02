// @ts-expect-error The app tsconfig carries no Node types; vitest runs in Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  bucketIndex,
  fillBuckets,
  followerSeries,
  interactionsOf,
  niceScale,
  rangeBuckets,
  recentWeeks,
  startOfLocalDay,
} from './analyticsMath';

describe('analyticsMath mirror', () => {
  it('web and mobile copies are identical', () => {
    const mobile: string = readFileSync(new URL('./analyticsMath.ts', import.meta.url), 'utf8');
    const web: string = readFileSync(new URL('../../apps/web/src/lib/analyticsMath.ts', import.meta.url), 'utf8');
    expect(web).toBe(mobile);
  });
});

describe('interactionsOf', () => {
  it('sums likes, comments, shares (reposts + quotes) and saves', () => {
    expect(interactionsOf({ likes: 3, comments: 2, shares: 1, saves: 4 })).toBe(10);
    expect(interactionsOf({ likes: 3 })).toBe(3);
    expect(interactionsOf(null)).toBe(0);
  });

  it('does not count link clicks as interactions', () => {
    expect(interactionsOf({ likes: 3, comments: 2, shares: 1, saves: 4, clicks: 5 })).toBe(10);
    expect(interactionsOf({ clicks: 9 })).toBe(0);
  });
});

describe('rangeBuckets', () => {
  it('zero-fills one bucket per calendar day, inclusive', () => {
    const from = new Date(2026, 9, 1, 15).getTime();
    const to = new Date(2026, 9, 7, 23, 59).getTime();
    const { buckets, step } = rangeBuckets(from, to);
    expect(step).toBe(1);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.value === 0)).toBe(true);
    expect(buckets[0].start).toBe(new Date(2026, 9, 1).getTime());
    expect(buckets[6].end).toBe(new Date(2026, 9, 8).getTime());
  });

  it('keeps every bucket on a local midnight across DST switches', () => {
    // March and October/November cover the common DST switches.
    for (const [m1, m2] of [[2, 3], [9, 10]]) {
      const { buckets } = rangeBuckets(new Date(2026, m1, 20).getTime(), new Date(2026, m2, 10).getTime());
      for (const b of buckets) {
        expect(startOfLocalDay(b.start)).toBe(b.start);
        expect(new Date(b.start).getHours()).toBe(0);
      }
      // A post late on each day lands in that day's bucket.
      for (let i = 0; i < buckets.length; i++) {
        const late = new Date(buckets[i].start);
        late.setHours(23, 30);
        expect(bucketIndex(buckets, late.getTime())).toBe(i);
      }
    }
  });

  it('switches to weekly buckets past ~2 months and clips the last one', () => {
    const from = new Date(2026, 0, 1).getTime();
    const to = new Date(2026, 3, 1).getTime();
    const { buckets, step } = rangeBuckets(from, to);
    expect(step).toBe(7);
    expect(buckets[buckets.length - 1].end).toBe(addLocalDays(to, 1));
  });
});

describe('fillBuckets', () => {
  it('drops events outside the range', () => {
    const { buckets } = rangeBuckets(new Date(2026, 9, 1).getTime(), new Date(2026, 9, 3).getTime());
    const out = fillBuckets(buckets, [
      { at: new Date(2026, 8, 30, 23).getTime(), value: 9 },
      { at: new Date(2026, 9, 2, 12).getTime(), value: 2 },
      { at: new Date(2026, 9, 4, 0, 1).getTime(), value: 9 },
    ]);
    expect(out.map((b) => b.value)).toEqual([0, 2, 0]);
  });
});

describe('followerSeries', () => {
  it('carries the last capture forward and never back-fills', () => {
    const { buckets } = rangeBuckets(new Date(2026, 9, 1).getTime(), new Date(2026, 9, 5).getTime());
    const series = followerSeries(buckets, [
      { channel_id: 'a', at: new Date(2026, 9, 2).getTime(), followers: 100 },
      { channel_id: 'a', at: new Date(2026, 9, 4).getTime(), followers: 110 },
      { channel_id: 'b', at: new Date(2026, 9, 3).getTime(), followers: 50 },
    ]);
    expect(series).toEqual([null, 100, 150, 160, 160]);
  });
});

describe('recentWeeks', () => {
  it('returns 8 zero-filled weeks ending today', () => {
    const now = new Date(2026, 10, 2, 10).getTime();
    const weeks = recentWeeks(now, [now, addLocalDays(now, -8)]);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].value).toBe(1);
    expect(weeks[6].value).toBe(1);
    expect(weeks[7].end).toBe(addLocalDays(now, 1));
  });
});

describe('niceScale', () => {
  it('rounds the top to a readable step and starts at zero', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    expect(niceScale(7).ticks).toEqual([0, 2, 4, 6, 8]);
    expect(niceScale(3).ticks).toEqual([0, 1, 2, 3]);
    expect(niceScale(930).max).toBe(1000);
    expect(niceScale(2.4, 4, false).ticks[1]).toBe(1);
  });
});
