import 'server-only';
import Stripe from 'stripe';
import { type BillingInterval, type PlanKey, isBillingInterval, isPlanKey } from './plans';

/**
 * Stripe integration boundary. The ONLY place that maps between our canonical
 * plan/interval pair and Stripe Price IDs.
 *
 * - The application speaks plan + billingInterval (monthly | annual).
 * - Stripe speaks price IDs. Mapping lives in env: one Price ID per
 *   plan+interval pair (6 prices), set as STRIPE_PRICE_<PLAN>_<INTERVAL>.
 * - The interval is NEVER inferred from the amount. The webhook resolves
 *   plan + interval by looking the Price ID up in this map.
 *
 * Required env:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_STARTER_MONTHLY  STRIPE_PRICE_STARTER_ANNUAL
 *   STRIPE_PRICE_PRO_MONTHLY      STRIPE_PRICE_PRO_ANNUAL
 *   STRIPE_PRICE_BUSINESS_MONTHLY STRIPE_PRICE_BUSINESS_ANNUAL
 */

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function pricesConfigured(): boolean {
  return (
    stripeConfigured() &&
    !!priceIdFor('starter', 'monthly') &&
    !!priceIdFor('starter', 'annual') &&
    !!priceIdFor('pro', 'monthly') &&
    !!priceIdFor('pro', 'annual') &&
    !!priceIdFor('business', 'monthly') &&
    !!priceIdFor('business', 'annual')
  );
}

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured — set STRIPE_SECRET_KEY.');
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Canonical price book → Stripe Price ID (server-side lookup, never the browser's). */
export function priceIdFor(plan: Exclude<PlanKey, 'free'>, interval: BillingInterval): string | undefined {
  const env =
    process.env[
      `STRIPE_PRICE_${plan.toUpperCase()}_${interval === 'monthly' ? 'MONTHLY' : 'ANNUAL'}`
    ];
  return env && env.length > 0 ? env : undefined;
}

/** Stripe Price ID → canonical plan + interval. Unknown price → null. */
export function resolveFromPriceId(
  priceId: string | null | undefined,
): { plan: Exclude<PlanKey, 'free'>; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of ['starter', 'pro', 'business'] as const) {
    for (const interval of ['monthly', 'annual'] as const) {
      if (priceIdFor(plan, interval) === priceId) return { plan, interval };
    }
  }
  return null;
}

/**
 * Validate a client-supplied selection against the canonical config and
 * return the server-determined Price ID. Free has no checkout.
 */
export function checkoutPriceId(
  plan: unknown,
  interval: unknown,
): { priceId: string; plan: Exclude<PlanKey, 'free'>; interval: BillingInterval } | null {
  if (!isPlanKey(plan) || plan === 'free') return null;
  if (!isBillingInterval(interval)) return null;
  const priceId = priceIdFor(plan, interval);
  if (!priceId) return null;
  return { priceId, plan, interval };
}

/** Period window of a Stripe subscription, normalized to ISO strings. */
export function subscriptionPeriod(sub: Stripe.Subscription): {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
} {
  const raw = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    currentPeriodStart:
      typeof raw.current_period_start === 'number'
        ? new Date(raw.current_period_start * 1000).toISOString()
        : null,
    currentPeriodEnd:
      typeof raw.current_period_end === 'number'
        ? new Date(raw.current_period_end * 1000).toISOString()
        : null,
  };
}

/** The price object on a subscription that drives the renewal. */
export function primaryPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

/** True when the plan on this subscription is one we sell. */
export function isKnownPlan(plan: string | null | undefined): plan is Exclude<PlanKey, 'free'> {
  return plan === 'starter' || plan === 'pro' || plan === 'business';
}

export const PAID_PLANS = ['starter', 'pro', 'business'] as const;
