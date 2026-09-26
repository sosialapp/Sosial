/**
 * Canonical pricing — mobile mirror of apps/web/src/lib/billing/plans.ts.
 * Keep both files numerically identical: one price book across the product.
 *
 * Rules: annual prices are explicit (2 months free, never monthly * 12);
 * feature limits are identical between monthly and annual of the same plan;
 * scheduled posts are limited PER CHANNEL; unlimited is null, never a giant
 * number; the Free watermark is forced ON and locked.
 */

export type BillingInterval = 'monthly' | 'annual';
export type PlanKey = 'free' | 'solo' | 'team' | 'business';

export interface PlanLimits {
  channels: number | null;
  scheduledPostsPerChannel: number | null;
  aiCredits: number | null;
  users: number | null;
  workspaces: number | null;
  watermarkRequired: boolean;
}

export interface PlanDef {
  key: PlanKey;
  label: string;
  blurb: string;
  badge: string;
  featured?: boolean;
  monthly: number;
  annual: number;
  limits: PlanLimits;
  points: string[];
}

export const PLANS: Record<PlanKey, PlanDef> = {
  free: {
    key: 'free',
    label: 'Free',
    blurb: 'Plan, create and publish your first posts.',
    badge: 'For getting started',
    monthly: 0,
    annual: 0,
    limits: { channels: 3, scheduledPostsPerChannel: 10, aiCredits: 20, users: 1, workspaces: 1, watermarkRequired: true },
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
    monthly: 12,
    annual: 120,
    limits: { channels: 6, scheduledPostsPerChannel: null, aiCredits: 500, users: 1, workspaces: 1, watermarkRequired: false },
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
    monthly: 29,
    annual: 290,
    limits: { channels: 25, scheduledPostsPerChannel: null, aiCredits: 1500, users: 5, workspaces: 5, watermarkRequired: false },
    points: [
      '25 connected channels',
      'Unlimited scheduled posts',
      '1,500 AI credits a month',
      '5 team members and 5 workspaces',
      'Approvals, roles and bulk scheduling',
    ],
  },
  business: {
    key: 'business',
    label: 'Business',
    blurb: 'For agencies and businesses.',
    badge: 'For agencies & businesses',
    monthly: 79,
    annual: 790,
    limits: { channels: 100, scheduledPostsPerChannel: null, aiCredits: 5000, users: null, workspaces: null, watermarkRequired: false },
    points: [
      '100 connected channels',
      'Unlimited scheduled posts',
      '5,000 AI credits a month',
      'Unlimited team members and workspaces',
      'Advanced analytics, custom reports and brand voice',
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ['free', 'solo', 'team', 'business'];
export const BILLING_INTERVALS: BillingInterval[] = ['monthly', 'annual'];

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && v in PLANS;
}

export function priceFor(key: PlanKey, interval: BillingInterval): number {
  return interval === 'monthly' ? PLANS[key].monthly : PLANS[key].annual;
}

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

export function limitsFor(key: PlanKey): PlanLimits {
  return PLANS[key].limits;
}

/**
 * Mobile builds ship with three entitlement keys (free | pro | team) that map
 * onto the canonical plans: Solo → 'pro', Team → 'team', Business → 'team'
 * (same entitlements). All paid gating only distinguishes free vs paid, so
 * the mapping is safe.
 */
export function internalKeyFor(key: PlanKey): 'free' | 'pro' | 'team' {
  if (key === 'free') return 'free';
  if (key === 'solo') return 'pro';
  return 'team';
}

export function labelForInternal(key: 'free' | 'pro' | 'team'): string {
  if (key === 'free') return 'Free';
  if (key === 'pro') return 'Solo';
  return 'Team';
}

/** AI credits consumed per action — mirror of web's aiCredits.ts. */
export const AI_CREDIT_COSTS: Record<string, number> = {
  rewrite: 1, shorten: 1, expand: 1, tone: 1, hashtags: 1, idea: 1,
  caption: 2, post: 2, adapt: 2,
  thread: 3, repurpose: 3, variations: 3,
  longform: 5,
};

export const AI_MODEL_LABEL = 'GPT-5.6 Luna';
