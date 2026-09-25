/**
 * Canonical pricing — mobile mirror of apps/web/src/lib/billing/plans.ts.
 * Keep both files identical in values: one price book across the product.
 *
 * Rules: annual prices are explicit (2 months free, never monthly * 12);
 * feature limits are identical between monthly and annual of the same plan;
 * unlimited is null, never a giant number.
 */

export type BillingInterval = 'monthly' | 'annual';
export type PlanKey = 'free' | 'starter' | 'pro' | 'business';

export interface PlanDef {
  key: PlanKey;
  label: string;
  monthly: number;
  annual: number;
  channels: number | null;
  scheduledPosts: number | null;
  aiGenerations: number | null;
}

export const PLANS: Record<PlanKey, PlanDef> = {
  free: {
    key: 'free', label: 'Free', monthly: 0, annual: 0,
    channels: 3, scheduledPosts: 30, aiGenerations: 0,
  },
  starter: {
    key: 'starter', label: 'Starter', monthly: 12, annual: 120,
    channels: null, scheduledPosts: null, aiGenerations: 500,
  },
  pro: {
    key: 'pro', label: 'Pro', monthly: 29, annual: 290,
    channels: null, scheduledPosts: null, aiGenerations: 1000,
  },
  business: {
    key: 'business', label: 'Business', monthly: 79, annual: 790,
    channels: null, scheduledPosts: null, aiGenerations: 2000,
  },
};

/** What the annual price works out to per month (display only — billed yearly). */
export function monthlyEquivalent(key: PlanKey): string {
  const v = (PLANS[key].annual / 12) * 100;
  return `$${(Math.round(v) / 100).toFixed(2)}`;
}

export function annualSavingsPct(key: PlanKey): number {
  const full = PLANS[key].monthly * 12;
  if (full === 0) return 0;
  return Math.round(((full - PLANS[key].annual) / full) * 100);
}

/**
 * Mobile builds ship with three entitlement keys (free | pro | team) that
 * predate the canonical plan names. This maps canonical ↔ internal without
 * renaming every internal check: Starter → 'pro', Pro and Business → 'team'.
 * All paid gating only distinguishes free vs paid, so the mapping is safe.
 */
export function internalKeyFor(key: PlanKey): 'free' | 'pro' | 'team' {
  if (key === 'free') return 'free';
  if (key === 'starter') return 'pro';
  return 'team';
}

export function labelForInternal(key: 'free' | 'pro' | 'team'): string {
  if (key === 'free') return 'Free';
  if (key === 'pro') return 'Starter';
  return 'Pro';
}
