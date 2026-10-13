import { describe, it, expect } from 'vitest';
import {
  PLANS,
  PLAN_ORDER,
  priceFor,
  monthlyEquivalent,
  annualSavingsPct,
  limitsFor,
  internalKeyFor,
  isPlanKey,
} from './plans';

/** The one price book, these numbers are contract. A change here MUST match
 *  apps/web/src/lib/billing/plans.ts and every pricing surface. */
describe('price book (contract)', () => {
  it('charges the exact published prices', () => {
    expect(priceFor('free', 'monthly')).toBe(0);
    expect(priceFor('solo', 'monthly')).toBe(12);
    expect(priceFor('solo', 'annual')).toBe(120);
    expect(priceFor('team', 'monthly')).toBe(29);
    expect(priceFor('team', 'annual')).toBe(290);
    expect(priceFor('business', 'monthly')).toBe(79);
    expect(priceFor('business', 'annual')).toBe(790);
    expect(priceFor('ultimate', 'monthly')).toBe(1); // lifetime, admin-only
  });

  it('keeps channel caps identical to the web plans.ts and plan_limits DB', () => {
    expect(limitsFor('free').channels).toBe(3);
    expect(limitsFor('solo').channels).toBe(6);
    expect(limitsFor('team').channels).toBe(25);
    expect(limitsFor('business').channels).toBe(100);
    expect(limitsFor('ultimate').channels).toBeNull();
  });

  it('keeps team caps: seats and owned workspaces', () => {
    expect(limitsFor('free').users).toBe(1);
    expect(limitsFor('solo').users).toBe(1);
    expect(limitsFor('team').users).toBe(5);
    expect(limitsFor('business').users).toBeNull();
    expect(limitsFor('free').workspaces).toBe(1);
    expect(limitsFor('solo').workspaces).toBe(1);
    expect(limitsFor('team').workspaces).toBe(3);
    expect(limitsFor('business').workspaces).toBe(6);
    expect(limitsFor('ultimate').workspaces).toBeNull();
  });

  it('forces the watermark on free and nowhere else', () => {
    expect(PLANS.free.limits.watermarkRequired).toBe(true);
    expect(PLAN_ORDER.every((k) => k === 'free' || !PLANS[k].limits.watermarkRequired)).toBe(true);
  });

  it('annual is exactly 2 months free (never monthly * 12)', () => {
    for (const key of ['solo', 'team', 'business'] as const) {
      expect(priceFor(key, 'annual')).toBe(priceFor(key, 'monthly') * 10);
    }
  });

  it('hides ultimate from the public plan order', () => {
    expect(PLAN_ORDER).not.toContain('ultimate');
    expect(PLAN_ORDER).toEqual(['free', 'solo', 'team', 'business']);
  });
});

describe('display helpers', () => {
  it('annual savings round to ~17% (2 months free)', () => {
    expect(annualSavingsPct('solo')).toBe(17);
    expect(annualSavingsPct('team')).toBe(17);
    expect(annualSavingsPct('business')).toBe(17);
    expect(annualSavingsPct('free')).toBe(0);
  });
  it('monthly equivalents ceil annual/12', () => {
    expect(monthlyEquivalent('solo')).toBe('$10');
    expect(monthlyEquivalent('team')).toBe('$25');
    expect(monthlyEquivalent('business')).toBe('$66');
  });
});

describe('gating helpers', () => {
  it('maps the mobile plan stub keys', () => {
    expect(internalKeyFor('free')).toBe('free');
    expect(internalKeyFor('solo')).toBe('pro');
    expect(internalKeyFor('team')).toBe('team');
    expect(internalKeyFor('business')).toBe('team');
    expect(internalKeyFor('ultimate')).toBe('team');
  });
  it('narrows plan keys safely', () => {
    expect(isPlanKey('team')).toBe(true);
    expect(isPlanKey('nope')).toBe(false);
    expect(isPlanKey(null)).toBe(false);
  });
});
