import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PLANS, type BillingInterval, type PlanKey } from './plans';

/**
 * Subscription entitlement for a workspace.
 *
 * Cancellation keeps the paid plan until currentPeriodEnd (cancel_at_period_end);
 * after the period ends the entitlement falls back to Free. Past-due keeps a
 * grace period on the current plan until the period ends.
 */

export interface Entitlement {
  plan: PlanKey;
  billingInterval: BillingInterval | null;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** paid entitlement currently in force */
  active: boolean;
}

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function getEntitlement(workspaceId: string): Promise<Entitlement> {
  const empty: Entitlement = {
    plan: 'free',
    billingInterval: null,
    status: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    active: false,
  };
  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('subscriptions')
      .select(
        'plan, billing_interval, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end',
      )
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!data) return empty;

    const plan = (data.plan ?? 'free') as PlanKey;
    const status = data.status ?? 'free';
    const end = data.current_period_end ? new Date(data.current_period_end) : null;
    const periodEnded = end ? end.getTime() <= Date.now() : false;
    const active =
      PAID_STATUSES.has(status) && !periodEnded && plan !== 'free';

    return {
      plan: active ? plan : 'free',
      billingInterval: (data.billing_interval as BillingInterval | null) ?? null,
      status,
      stripeCustomerId: data.stripe_customer_id ?? null,
      stripeSubscriptionId: data.stripe_subscription_id ?? null,
      currentPeriodStart: data.current_period_start ?? null,
      currentPeriodEnd: data.current_period_end ?? null,
      cancelAtPeriodEnd: !!data.cancel_at_period_end,
      active,
    };
  } catch {
    return empty;
  }
}

/** Feature limits for the workspace's current entitlement (interval-independent). */
export function limitsFor(plan: PlanKey) {
  return PLANS[plan].limits;
}
