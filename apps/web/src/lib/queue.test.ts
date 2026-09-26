import { describe, expect, it } from 'vitest';
import {
  MIN_QUEUE_LEAD_MS,
  assertQueueLeadTime,
  leadTimeMessage,
  minQueueLabel,
  minQueueTime,
  queueTooSoon,
} from './queue';

describe('queue lead-time rule (mobile parity)', () => {
  it('requires a 5 minute lead', () => {
    expect(MIN_QUEUE_LEAD_MS).toBe(5 * 60 * 1000);
  });

  it('floors the earliest instant to the minute', () => {
    // 2026-09-26T07:51:37 local -> earliest 07:56:00
    const now = new Date(2026, 8, 26, 7, 51, 37).getTime();
    const min = minQueueTime(now);
    const d = new Date(min);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([7, 56, 0]);
  });

  it('blocks anything before the floored minute, allows the minute itself', () => {
    const now = new Date(2026, 8, 26, 7, 51, 37).getTime();
    const min = minQueueTime(now);
    expect(queueTooSoon(min - 1, now)).toBe(true);
    expect(queueTooSoon(min, now)).toBe(false);
    expect(queueTooSoon(min + 60_000, now)).toBe(false);
  });

  it('accepts ISO strings and rejects garbage', () => {
    const now = Date.now();
    expect(queueTooSoon(new Date(minQueueTime(now) + 60_000).toISOString(), now)).toBe(false);
    expect(queueTooSoon(new Date(now + 60_000).toISOString(), now)).toBe(true);
    expect(queueTooSoon('not-a-date', now)).toBe(true);
  });

  it('labels the earliest minute and throws the mobile-identical message', () => {
    const now = new Date(2026, 8, 26, 7, 51, 37).getTime();
    expect(minQueueLabel(now)).toContain('56');
    expect(leadTimeMessage(now)).toContain('at least 5 minutes lead time');
    expect(() => assertQueueLeadTime(null, now)).toThrow('Choose a valid date and time.');
    expect(() => assertQueueLeadTime(new Date(now + 60_000).toISOString(), now)).toThrow(
      'at least 5 minutes lead time',
    );
    expect(() =>
      assertQueueLeadTime(new Date(minQueueTime(now)).toISOString(), now),
    ).not.toThrow();
  });
});
