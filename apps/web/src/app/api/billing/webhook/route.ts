import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  stripe,
  resolveFromPriceId,
  primaryPriceId,
  subscriptionPeriod,
} from '@/lib/billing/stripe';
import { isPlanKey, isBillingInterval, type BillingInterval, type PlanKey } from '@/lib/billing/plans';

export const runtime = 'nodejs';

/**
 * Stripe webhook sink. All subscription truth flows through here:
 *
 * - Signature-verified (STRIPE_WEBHOOK_SECRET); raw body required.
 * - Idempotent: event ids are recorded in billing_events; duplicates are
 *   acknowledged and skipped, so repeated deliveries never double-apply.
 * - Plan + billing interval are derived from the subscription's PRICE ID via
 *   the canonical map — never from the browser and never from the amount.
 * - Out-of-order-safe: every handler upserts the full current state of the
 *   subscription, so late-arriving stale events converge to the same row.
 * - Cancellation/expiry lands here as customer.subscription.deleted (or an
 *   inactive status) → plan falls back to Free. Content and connected
 *   channels are never touched.
 */

const TERMINAL = new Set(['canceled', 'unpaid', 'incomplete_expired']);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

async function claimEvent(eventId: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const { error } = await admin.from('billing_events').insert({ event_id: eventId, type: '' });
  // Unique violation → duplicate delivery already handled.
  return !error;
}

async function releaseEvent(eventId: string) {
  const admin = supabaseAdmin();
  await admin.from('billing_events').delete().eq('event_id', eventId);
}

async function markType(eventId: string, type: string) {
  const admin = supabaseAdmin();
  await admin.from('billing_events').update({ type }).eq('event_id', eventId);
}

async function resolveWorkspaceId(
  sub: Stripe.Subscription,
  fallbackWorkspaceId: string | null,
): Promise<string | null> {
  const meta = sub.metadata?.workspace_id;
  if (meta) return meta;
  if (fallbackWorkspaceId) return fallbackWorkspaceId;

  const admin = supabaseAdmin();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const bySub = await admin
    .from('subscriptions')
    .select('workspace_id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();
  if (bySub.data?.workspace_id) return bySub.data.workspace_id;
  const byCust = await admin
    .from('subscriptions')
    .select('workspace_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return byCust.data?.workspace_id ?? null;
}

/** Upsert the subscription row from the live Stripe subscription object. */
async function syncSubscription(sub: Stripe.Subscription, fallbackWorkspaceId: string | null) {
  const admin = supabaseAdmin();
  const workspaceId = await resolveWorkspaceId(sub, fallbackWorkspaceId);
  if (!workspaceId) return; // not ours / unattributable — ignore

  const priceId = primaryPriceId(sub);
  const resolved = resolveFromPriceId(priceId);
  const period = subscriptionPeriod(sub);

  // Plan + interval come from the PRICE (Stripe data). Our own checkout
  // metadata is only a fallback for legacy/unknown prices — still
  // server-side data, never anything the browser sent.
  const metaPlan = sub.metadata?.plan;
  const metaInterval = sub.metadata?.interval;
  const plan: PlanKey =
    resolved?.plan ??
    (isPlanKey(metaPlan) && metaPlan !== 'free' ? metaPlan : 'free');
  const interval: BillingInterval | null =
    resolved?.interval ?? (isBillingInterval(metaInterval) ? metaInterval : null);

  const inactive = TERMINAL.has(sub.status) || sub.status === 'incomplete';

  await admin.from('subscriptions').upsert(
    {
      workspace_id: workspaceId,
      plan: inactive ? 'free' : plan,
      billing_interval: inactive ? null : interval,
      status: sub.status,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: inactive ? null : priceId,
      current_period_start: period.currentPeriodStart,
      current_period_end: period.currentPeriodEnd,
      cancel_at_period_end: !!sub.cancel_at_period_end && !inactive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' },
  );
}

async function retrieveSubscription(id: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe().subscriptions.retrieve(id);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return bad('Webhook secret not configured.', 503);

  const signature = req.headers.get('stripe-signature');
  if (!signature) return bad('Missing stripe-signature header.');

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return bad('Invalid signature.', 400);
  }

  if (!(await claimEvent(event.id))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (subId) {
          const sub = await retrieveSubscription(subId);
          if (sub) await syncSubscription(sub, session.client_reference_id ?? session.metadata?.workspace_id ?? null);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object, null);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
        const subId =
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          const sub = await retrieveSubscription(subId);
          if (sub) await syncSubscription(sub, null);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
        const subId =
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          const sub = await retrieveSubscription(subId);
          if (sub) await syncSubscription(sub, null);
        }
        break;
      }
      default:
        // Unhandled types are fine — recorded and acknowledged.
        break;
    }
  } catch (e) {
    // Release the claim so Stripe's retry is not swallowed as a duplicate —
    // handlers are idempotent upserts, so re-application always converges.
    await releaseEvent(event.id).catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Webhook handling failed.' },
      { status: 500 },
    );
  }

  await markType(event.id, event.type);
  return NextResponse.json({ received: true });
}
