import { describe, expect, it } from 'vitest';
import { MINUTE } from './cadence';
import { Tracker, backoffUntil, budgetSpent, inBackoff, noteResponse, readUsage, runTracked } from './usage';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

describe('readUsage', () => {
  it('takes the fullest Meta window from X-App-Usage', () => {
    const r = readUsage(200, headers({ 'x-app-usage': '{"call_count":12,"total_cputime":40,"total_time":85}' }), undefined, NOW);
    expect(r.pct).toBe(85);
    expect(r.limited).toBe(false);
  });

  it('reads business use case usage and the regain time', () => {
    const r = readUsage(
      200,
      headers({
        'x-business-use-case-usage':
          '{"1234":[{"type":"pages","call_count":91,"total_cputime":5,"total_time":5,"estimated_time_to_regain_access":12}]}',
      }),
      undefined,
      NOW,
    );
    expect(r.pct).toBe(91);
    expect(r.regainMs).toBe(12 * MINUTE);
  });

  it('reads X rate-limit headers', () => {
    const reset = Math.floor((NOW + 7 * MINUTE) / 1000);
    const r = readUsage(200, headers({ 'x-rate-limit-remaining': '0', 'x-rate-limit-reset': String(reset) }), undefined, NOW);
    expect(r.remaining).toBe(0);
    expect(r.resetAt).toBe(reset * 1000);
  });

  it('treats Meta throttle error codes as limited even without a 429', () => {
    expect(readUsage(400, headers({}), { error: { code: 4 } }, NOW).limited).toBe(true);
    expect(readUsage(400, headers({}), { error: { code: 100 } }, NOW).limited).toBe(false);
  });

  it('ignores garbage headers', () => {
    const r = readUsage(200, headers({ 'x-app-usage': 'not json' }), undefined, NOW);
    expect(r.pct).toBeNull();
    expect(backoffUntil(r, NOW)).toBeNull();
  });
});

describe('backoffUntil', () => {
  const quiet = { pct: null, regainMs: null, resetAt: null, remaining: null, limited: false };

  it('carries on below the soft limit', () => {
    expect(backoffUntil({ ...quiet, pct: 60 }, NOW)).toBeNull();
  });

  it('holds 30 minutes (or the regain time) past 80%', () => {
    expect(backoffUntil({ ...quiet, pct: 82 }, NOW)).toBe(NOW + 30 * MINUTE);
    expect(backoffUntil({ ...quiet, pct: 95, regainMs: 50 * MINUTE }, NOW)).toBe(NOW + 50 * MINUTE);
  });

  it('waits for the X window reset when it is used up or a 429 comes back', () => {
    expect(backoffUntil({ ...quiet, remaining: 0, resetAt: NOW + 9 * MINUTE }, NOW)).toBe(NOW + 9 * MINUTE);
    expect(backoffUntil({ ...quiet, limited: true, resetAt: NOW + 12 * MINUTE }, NOW)).toBe(NOW + 12 * MINUTE);
  });

  it('holds a bare 429 for 15 minutes and never less than 5', () => {
    expect(backoffUntil({ ...quiet, limited: true }, NOW)).toBe(NOW + 15 * MINUTE);
    expect(backoffUntil({ ...quiet, limited: true, resetAt: NOW + 10_000 }, NOW)).toBe(NOW + 5 * MINUTE);
  });

  it('never holds longer than a day', () => {
    expect(backoffUntil({ ...quiet, limited: true, regainMs: 3 * 24 * 60 * MINUTE }, NOW)).toBe(NOW + 24 * 60 * MINUTE);
  });
});

describe('tracked jobs', () => {
  it('records responses only inside runTracked and flags the job as spent', async () => {
    noteResponse(429, headers({})); // outside: ignored
    const { tracker, result } = await runTracked(async () => {
      expect(budgetSpent()).toBe(false);
      noteResponse(200, headers({ 'x-app-usage': '{"call_count":10}' }));
      expect(budgetSpent()).toBe(false);
      noteResponse(429, headers({ 'retry-after': '600' }));
      return budgetSpent();
    });
    expect(result).toBe(true);
    expect(tracker.limited).toBe(true);
    expect(tracker.until).not.toBeNull();
  });

  it('keeps the latest hold across responses', () => {
    const t = new Tracker();
    t.observe(200, headers({ 'x-app-usage': '{"call_count":85}' }), undefined, NOW);
    t.observe(429, headers({ 'retry-after': '3600' }), undefined, NOW);
    expect(t.until).toBe(NOW + 60 * MINUTE);
    expect(t.reason).toMatch(/429/);
  });

  it('returns the error instead of throwing', async () => {
    const { error } = await runTracked(async () => {
      throw new Error('boom');
    });
    expect(String(error)).toMatch(/boom/);
  });
});

describe('inBackoff', () => {
  it('is true only for a future timestamp', () => {
    expect(inBackoff(new Date(NOW + MINUTE).toISOString(), NOW)).toBe(true);
    expect(inBackoff(new Date(NOW - MINUTE).toISOString(), NOW)).toBe(false);
    expect(inBackoff(null, NOW)).toBe(false);
  });
});

describe('payment required (402)', () => {
  it('holds six hours, whatever the rate headers say', () => {
    const r = readUsage(402, headers({ 'x-rate-limit-reset': String(NOW / 1000 + 60) }), { title: 'CreditsDepleted' }, NOW);
    expect(r.limited).toBe(true);
    expect(backoffUntil(r, NOW)).toBe(NOW + 360 * MINUTE);
  });

  it('completes the job instead of retrying, and names the cause', async () => {
    const { tracker, error } = await runTracked(async () => {
      noteResponse(402, headers({}), { title: 'CreditsDepleted' });
      expect(budgetSpent()).toBe(true);
      throw new Error('X messages: request failed (402)');
    });
    expect(error).toBeDefined();
    expect(tracker.limited).toBe(true);
    expect(tracker.reason).toContain('CreditsDepleted');
  });
});
