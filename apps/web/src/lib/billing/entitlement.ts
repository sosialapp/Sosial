import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { BillingInterval, PlanKey } from './plans';

/**
 * Subscription entitlement for a workspace.
 *
 * The plan follows the OWNER, never the team: the entitlement is the owner's
 * best active subscription across every team they own (which includes this
 * team, since the owner owns it). Transferring ownership therefore re-limits
 * the team to the new owner's plan. Mirrors public.workspace_plan (the DB
 * limit triggers) exactly - CHANGE TOGETHER.
 *
 * Cancellation keeps the paid plan until currentPeriodEnd (cancel_at_period_end);
 * after the period ends the entitlement falls back to Free. Past-due keeps a
 * grace period on the current plan until the period ends. Ultimate lifetime
 * (status 'lifetime') never expires and has no period end.
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

/** Picks the best plan when an owner has several active rows. */
const PLAN_RANK: Record<string, number> = { ultimate: 4, business: 3, team: 2, solo: 1 };

interface SubRow {
  workspace_id: string;
  plan: string | null;
  billing_interval: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

const SUB_COLS =
  'workspace_id, plan, billing_interval, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end';

const FREE: Entitlement = {
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

function isActive(row: SubRow): boolean {
  const plan = (row.plan ?? 'free') as PlanKey;
  const status = row.status ?? 'free';
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  const periodEnded = end ? end.getTime() <= Date.now() : false;
  const lifetime = plan === 'ultimate' && status === 'lifetime';
  return (PAID_STATUSES.has(status) || lifetime) && !periodEnded && plan !== 'free';
}

function toEntitlement(row: SubRow | null): Entitlement {
  if (!row) return FREE;
  const plan = (row.plan ?? 'free') as PlanKey;
  const status = row.status ?? 'free';
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  const periodEnded = end ? end.getTime() <= Date.now() : false;
  const lifetime = plan === 'ultimate' && status === 'lifetime';
  const active = (PAID_STATUSES.has(status) || lifetime) && !periodEnded && plan !== 'free';
  return {
    plan: active ? plan : 'free',
    billingInterval: (row.billing_interval as BillingInterval | null) ?? null,
    status,
    stripeCustomerId: row.stripe_customer_id ?? null,
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    active,
  };
}

export async function getEntitlement(workspaceId: string): Promise<Entitlement> {
  try {
    const admin = supabaseAdmin();

    // Plan follows the OWNER: their best active subscription across every team
    // they own. This team is in that set (they own it), so a per-team row is
    // neither favoured nor excluded - it just competes on rank like the rest.
    const { data: ws } = await admin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();
    const ownerId = (ws as { owner_id?: string | null } | null)?.owner_id ?? null;
    if (!ownerId) return FREE;

    // One round-trip for the owner's subscriptions across every team they own
    // (this team is in that set, so it competes on rank like the rest). The
    // embedded filter avoids the old "list owned ids, then .in()" hop.
    const { data: subs, error: subsErr } = await admin
      .from('subscriptions')
      .select(`${SUB_COLS}, workspaces!inner(owner_id)`)
      .eq('workspaces.owner_id', ownerId);
    // Never let a broken service-role read look like "this team is Free".
    if (subsErr) console.error('[entitlement] subscriptions read failed:', subsErr.message);

    const candidates = ((subs ?? []) as SubRow[]).filter(isActive);
    if (!candidates.length) return FREE;

    candidates.sort((a, b) => (PLAN_RANK[b.plan ?? ''] ?? 0) - (PLAN_RANK[a.plan ?? ''] ?? 0));
    return toEntitlement(candidates[0]);
  } catch (err) {
    console.error('[entitlement] falling back to Free:', err);
    return FREE;
  }
}
