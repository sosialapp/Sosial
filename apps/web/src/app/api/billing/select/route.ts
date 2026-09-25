import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkoutPriceId, pricesConfigured, stripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

/**
 * The single entry point for "user picked plan X on interval Y".
 *
 * Server-side only: the browser's plan/interval are validated against the
 * canonical config and the Stripe Price ID is resolved HERE — the client can
 * never submit a price, amount or an interval swap. A user with an existing
 * Stripe subscription gets that ONE subscription updated in place (prorated),
 * so upgrades, downgrades and monthly↔annual switches never create a second
 * subscription. Without a subscription, a Stripe Checkout session is created.
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let body: { plan?: unknown; interval?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  // Validate against the canonical config — never trust the browser.
  const selected = checkoutPriceId(body.plan, body.interval);
  if (!selected) {
    return NextResponse.json(
      { error: 'Unknown plan or billing interval.' },
      { status: 400 },
    );
  }
  if (!pricesConfigured()) {
    return NextResponse.json(
      { error: 'Billing is not configured yet — Stripe price IDs are missing.' },
      { status: 503 },
    );
  }

  const admin = supabaseAdmin();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  const hasLiveSub =
    !!sub?.stripe_subscription_id &&
    ['active', 'trialing', 'past_due'].includes(sub.status ?? '');

  const origin = req.headers.get('origin') ?? new URL(req.url).origin;

  try {
    const s = stripe();

    // ---- Existing subscription: change it in place (ONE subscription) ----
    if (hasLiveSub && sub?.stripe_customer_id && sub.stripe_subscription_id) {
      const existing = await s.subscriptions.retrieve(sub.stripe_subscription_id);
      const item = existing.items.data[0];
      if (!item) throw new Error('Subscription has no items.');

      await s.subscriptions.update(existing.id, {
        items: [{ id: item.id, price: selected.priceId }],
        // Stripe-standard proration: immediate change, unused time credited,
        // new price charged from now. Applies to upgrades, downgrades AND
        // monthly↔annual switches. Nothing is refunded; the invoice reflects
        // the difference.
        proration_behavior: 'create_prorations',
        // Switching interval restarts the billing anchor at the change date.
        billing_cycle_anchor: 'now',
        cancel_at_period_end: false,
        metadata: {
          workspace_id: ctx.workspace.id,
          plan: selected.plan,
          interval: selected.interval,
        },
      });
      return NextResponse.json({ mode: 'updated' });
    }

    // ---- New subscription: Stripe Checkout ----
    let customerId = sub?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await s.customers.create({
        email: ctx.user.email ?? undefined,
        metadata: { workspace_id: ctx.workspace.id },
      });
      customerId = customer.id;
      await admin
        .from('subscriptions')
        .upsert(
          { workspace_id: ctx.workspace.id, stripe_customer_id: customerId },
          { onConflict: 'workspace_id' },
        );
    }

    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: selected.priceId, quantity: 1 }],
      client_reference_id: ctx.workspace.id,
      subscription_data: {
        metadata: {
          workspace_id: ctx.workspace.id,
          plan: selected.plan,
          interval: selected.interval,
        },
      },
      metadata: {
        workspace_id: ctx.workspace.id,
        plan: selected.plan,
        interval: selected.interval,
      },
      // Let customers edit quantity? No — one flat subscription per workspace.
      allow_promotion_codes: true,
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });

    return NextResponse.json({ mode: 'checkout', url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Stripe request failed.' },
      { status: 502 },
    );
  }
}
