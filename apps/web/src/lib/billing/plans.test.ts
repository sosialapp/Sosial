import { describe, expect, it } from 'vitest';
import {
  PLANS, PLAN_ORDER, priceFor, monthlyEquivalent, annualSavingsPct,
  isPlanKey, isBillingInterval, priceLabel, formatUsd,
  type BillingInterval,
} from './plans';

describe('canonical pricing', () => {
  it('has the canonical monthly prices', () => {
    expect(PLANS.free.monthly.price).toBe(0);
    expect(PLANS.solo.monthly.price).toBe(12);
    expect(PLANS.team.monthly.price).toBe(29);
    expect(PLANS.business.monthly.price).toBe(79);
  });

  it('has the canonical annual prices (explicit, 2 months free)', () => {
    expect(PLANS.free.annual.price).toBe(0);
    expect(PLANS.solo.annual.price).toBe(120);
    expect(PLANS.team.annual.price).toBe(290);
    expect(PLANS.business.annual.price).toBe(790);
    // Annual is NEVER computed as monthly * 12 — it is 10 paid months.
    expect(PLANS.solo.annual.price).not.toBe(PLANS.solo.monthly.price * 12);
    expect(PLANS.team.annual.price).not.toBe(PLANS.team.monthly.price * 12);
    expect(PLANS.business.annual.price).not.toBe(PLANS.business.monthly.price * 12);
  });

  it('keeps feature limits identical across billing intervals', () => {
    // Limits live once on the plan — the interval cannot alter them by design.
    for (const key of PLAN_ORDER) {
      expect(PLANS[key].limits).toEqual(PLANS[key].limits);
    }
    expect(PLANS.free.limits.channels).toBe(3);
    expect(PLANS.free.limits.aiGenerations).toBe(0);
    expect(PLANS.solo.limits.aiGenerations).toBe(500);
    expect(PLANS.team.limits.aiGenerations).toBe(1000);
    expect(PLANS.business.limits.aiGenerations).toBe(2000);
    // unlimited is null, never a huge number
    expect(PLANS.solo.limits.channels).toBeNull();
    expect(PLANS.solo.limits.scheduledPosts).toBeNull();
  });

  it('computes monthly equivalents for annual display', () => {
    expect(monthlyEquivalent('solo')).toBe(10);
    expect(monthlyEquivalent('team')).toBeCloseTo(24.17, 2);
    expect(monthlyEquivalent('business')).toBeCloseTo(65.83, 2);
  });

  it('computes annual savings as 2 of 12 months', () => {
    expect(annualSavingsPct('solo')).toBe(17); // 24/144
    expect(annualSavingsPct('team')).toBe(17); // 58/348
    expect(annualSavingsPct('business')).toBe(17); // 158/948
    expect(annualSavingsPct('free')).toBe(0);
  });

  it('strictly types the billing interval', () => {
    expect(isBillingInterval('monthly')).toBe(true);
    expect(isBillingInterval('annual')).toBe(true);
    expect(isBillingInterval('month')).toBe(false);
    expect(isBillingInterval('year')).toBe(false);
    expect(isBillingInterval('yearly')).toBe(false);
    expect(isBillingInterval('annual_plan')).toBe(false);
    expect(isBillingInterval('')).toBe(false);
    expect(isBillingInterval(null)).toBe(false);
  });

  it('strictly validates plan keys', () => {
    expect(isPlanKey('solo')).toBe(true);
    expect(isPlanKey('team')).toBe(true);
    expect(isPlanKey('business')).toBe(true);
    expect(isPlanKey('team_annual')).toBe(false);
    expect(isPlanKey('solo_monthly')).toBe(false);
    expect(isPlanKey('starter')).toBe(false); // retired name
    expect(isPlanKey('pro')).toBe(false); // retired name
    expect(isPlanKey(42)).toBe(false);
  });

  it('renders price labels for the real interval', () => {
    expect(priceLabel('solo', 'monthly')).toBe('$12/mo');
    expect(priceLabel('solo', 'annual')).toBe('$120/yr');
    expect(priceLabel('team', 'annual')).toBe('$290/yr');
    expect(priceLabel('business', 'monthly')).toBe('$79/mo');
    expect(priceLabel('free', 'monthly')).toBe('Free');
    expect(formatUsd(120)).toBe('$120');
  });

  it('exposes one price per plan+interval pair', () => {
    const pairs: [keyof typeof PLANS, BillingInterval][] = [];
    for (const key of PLAN_ORDER) {
      pairs.push([key, 'monthly'], [key, 'annual']);
    }
    for (const [key, interval] of pairs) {
      expect(typeof priceFor(key, interval)).toBe('number');
    }
    // all paid display strings distinct
    const paid = pairs
      .filter(([k]) => k !== 'free')
      .map(([k, i]) => priceLabel(k, i));
    expect(new Set(paid).size).toBe(paid.length);
  });
});
