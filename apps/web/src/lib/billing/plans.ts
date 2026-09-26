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
 * - Scheduled posts are limited PER CONNECTED CHANNEL, not globally.
 * - The billing period (Stripe renewal) is distinct from the usage period
 *   (calendar month). AI credits reset every calendar month even for annual
 *   subscribers; scheduled-post slots free up when a post is published.
 */

export type BillingInterval = 'monthly' | 'annual';

export type PlanKey = 'free' | 'solo' | 'team' | 'business';

export interface PlanLimits {
  /** connectable channels (one per connected social account); null = unlimited */
  channels: number | null;
  /** scheduled (not yet published) posts allowed PER connected channel; null = unlimited */
  scheduledPostsPerChannel: number | null;
  /** AI credits granted per calendar month; null = unlimited */
  aiCredits: number | null;
  /** team seats including the owner; null = unlimited */
  users: number | null;
  /** workspaces (brands) the user may own; null = unlimited */
  workspaces: number | null;
  /** true ⇒ the Sosial watermark is forced ON and cannot be disabled */
  watermarkRequired: boolean;
}

export interface PlanPrice {
  /** whole USD amount billed at this interval */
  price: number;
}

export interface PlanDef {
  key: PlanKey;
  label: string;
  /** short positioning line used on cards */
  blurb: string;
  /** who it is for, used as the card badge */
  badge: string;
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
    blurb: 'Plan, create and publish your first posts.',
    badge: 'For getting started',
    monthly: { price: 0 },
    annual: { price: 0 },
    limits: {
      channels: 3,
      scheduledPostsPerChannel: 10,
      aiCredits: 20,
      users: 1,
      workspaces: 1,
      watermarkRequired: true,
    },
    points: [
      '3 connected channels',
      '10 scheduled posts per channel',
      '20 AI credits a month',
      'Calendar, queue and auto-publishing',
      'Basic analytics',
    ],
  },
  solo: {
    key: 'solo',
    label: 'Solo',
    blurb: 'For creators and individuals.',
    badge: 'For creators & individuals',
    monthly: { price: 12 },
    annual: { price: 120 },
    limits: {
      channels: 6,
      scheduledPostsPerChannel: null,
      aiCredits: 500,
      users: 1,
      workspaces: 1,
      watermarkRequired: false,
    },
    points: [
      '6 connected channels',
      'Unlimited scheduled posts',
      '500 AI credits a month',
      'Media library and content organization',
      'Analytics with reach, engagement and top posts',
    ],
  },
  team: {
    key: 'team',
    label: 'Team',
    blurb: 'For growing teams.',
    badge: 'For growing teams',
    featured: true,
    monthly: { price: 29 },
    annual: { price: 290 },
    limits: {
      channels: 25,
      scheduledPostsPerChannel: null,
      aiCredits: 1500,
      users: 5,
      workspaces: 5,
      watermarkRequired: false,
    },
    points: [
      '25 connected channels',
      'Unlimited scheduled posts',
      '1,500 AI credits a month',
      '5 team members and 5 workspaces',
      'Approval workflows and roles',
    ],
  },
  business: {
    key: 'business',
    label: 'Business',
    blurb: 'For agencies and businesses.',
    badge: 'For agencies & businesses',
    monthly: { price: 79 },
    annual: { price: 790 },
    limits: {
      channels: 100,
      scheduledPostsPerChannel: null,
      aiCredits: 5000,
      users: null,
      workspaces: null,
      watermarkRequired: false,
    },
    points: [
      '100 connected channels',
      'Unlimited scheduled posts',
      '5,000 AI credits a month',
      'Unlimited team members and workspaces',
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

/** The plan the user would move up to next (for upgrade CTAs), or null. */
export function nextPlan(plan: PlanKey): Exclude<PlanKey, 'free'> | null {
  const i = PLAN_ORDER.indexOf(plan);
  const next = PLAN_ORDER[i + 1];
  return next && next !== 'free' ? (next as Exclude<PlanKey, 'free'>) : null;
}

/** Limits for a plan (interval-independent). */
export function limitsFor(plan: PlanKey): PlanLimits {
  return PLANS[plan].limits;
}
