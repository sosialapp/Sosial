/**
 * Canonical billing configuration — the ONE source of truth for plans,
 * prices, billing intervals and feature limits across the whole product.
 *
 * Rules encoded here (do not violate downstream):
 * - A plan and its billing interval are SEPARATE concepts (plan = "team",
 *   billingInterval = "annual" — never "team_annual").
 * - Annual prices are explicit values (10 paid months = 2 months free).
 *   NEVER compute annual = monthly * 12.
 * - Feature limits are identical between monthly and annual of the same
 *   plan. The interval changes price + renewal period only.
 * - Unlimited is `null`, never 999999.
 * - The billing period (Stripe renewal) is distinct from the usage period
 *   (calendar month). Usage-based allowances (AI generations, scheduled
 *   posts) reset every calendar month even for annual subscribers.
 */

export type BillingInterval = 'monthly' | 'annual';

export type PlanKey = 'free' | 'solo' | 'team' | 'business';

export interface PlanLimits {
  /** connectable channels; null = unlimited */
  channels: number | null;
  /** scheduled posts per usage month; null = unlimited */
  scheduledPosts: number | null;
  /** AI generations per usage month; null = unlimited */
  aiGenerations: number | null;
}

export interface PlanPrice {
  /** whole USD amount billed at this interval */
  price: number;
}

export interface PlanDef {
  key: PlanKey;
  label: string;
  blurb: string;
  featured?: boolean;
  monthly: PlanPrice;
  annual: PlanPrice;
  limits: PlanLimits;
  points: string[];
}

/** The canonical price book. Prices are explicit — never derived. */
export const PLANS: Record<PlanKey, PlanDef> = {
  free: {
    key: 'free',
    label: 'Free',
    blurb: 'Enough to replace posting by hand.',
    monthly: { price: 0 },
    annual: { price: 0 },
    limits: { channels: 3, scheduledPosts: 30, aiGenerations: 0 },
    points: [
      '3 connected channels',
      '30 scheduled posts a month',
      'One calendar and queue',
      'Per-channel previews and live limits',
      'iOS, Android and web',
    ],
  },
  solo: {
    key: 'solo',
    label: 'Solo',
    blurb: 'Publish everywhere, every day.',
    monthly: { price: 12 },
    annual: { price: 120 },
    limits: { channels: null, scheduledPosts: null, aiGenerations: 500 },
    points: [
      'All 10 channels connected',
      'Unlimited scheduled posts',
      'AI writer with live research',
      'Templates and studio',
      'Analytics across every channel',
    ],
  },
  team: {
    key: 'team',
    label: 'Team',
    blurb: 'Draft together, approve in one tap.',
    featured: true,
    monthly: { price: 29 },
    annual: { price: 290 },
    limits: { channels: null, scheduledPosts: null, aiGenerations: 1000 },
    points: [
      'Everything in Solo',
      'Approvals and review notes',
      'Member, admin and owner roles',
      'Shared calendar for the whole team',
      'Priority support',
    ],
  },
  business: {
    key: 'business',
    label: 'Business',
    blurb: 'Scale the whole operation.',
    monthly: { price: 79 },
    annual: { price: 790 },
    limits: { channels: null, scheduledPosts: null, aiGenerations: 2000 },
    points: [
      'Everything in Team',
      '1,000 extra AI generations a month',
      'Unlimited seats for the whole crew',
      'Per-channel member roles',
      'Premium support',
    ],
  },
};

/** Canonical display order, cheapest first. */
export const PLAN_ORDER: PlanKey[] = ['free', 'solo', 'team', 'business'];

export const BILLING_INTERVALS: BillingInterval[] = ['monthly', 'annual'];

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && v in PLANS;
}

export function isBillingInterval(v: unknown): v is BillingInterval {
  return v === 'monthly' || v === 'annual';
}

/** Price billed at the given interval (never computed from the other one). */
export function priceFor(plan: PlanKey, interval: BillingInterval): number {
  return PLANS[plan][interval].price;
}

/** What the annual price works out to per month (display only — the charge is annual). */
export function monthlyEquivalent(plan: PlanKey): number {
  return Math.round((PLANS[plan].annual.price / 12) * 100) / 100;
}

/** Percent saved on annual vs paying monthly for 12 months. */
export function annualSavingsPct(plan: PlanKey): number {
  const full = PLANS[plan].monthly.price * 12;
  if (full === 0) return 0;
  return Math.round(((full - PLANS[plan].annual.price) / full) * 100);
}

/** "$12" / "$120" — whole dollars, no decimals needed at these price points. */
export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** "$290/year · billed annually" display strings. */
export function intervalLabel(interval: BillingInterval): string {
  return interval === 'monthly' ? 'month' : 'year';
}

export function priceLabel(plan: PlanKey, interval: BillingInterval): string {
  const p = PLANS[plan][interval].price;
  if (plan === 'free') return 'Free';
  return `${formatUsd(p)}/${interval === 'monthly' ? 'mo' : 'yr'}`;
}
