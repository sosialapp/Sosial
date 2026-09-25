import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { pricesConfigured, stripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

/**
 * Cancel / resume. Cancelling does NOT end the plan immediately: the
 * subscription stays active until currentPeriodEnd (cancel_at_period_end),
 * then falls back to Free via the webhook. Resuming clears the flag.
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let body: { cancel?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const cancel = body.cancel === true;

  if (!pricesConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 });
  }

  const admin = supabaseAdmin();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (!sub?.stripe_subscription_id || !['active', 'trialing', 'past_due'].includes(sub.status ?? '')) {
    return NextResponse.json({ error: 'No active subscription to cancel.' }, { status: 409 });
  }

  try {
    await stripe().subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: cancel,
    });
    // Stripe sends customer.subscription.updated; also mirror locally so the
    // UI flips instantly even if the webhook is delayed.
    await admin
      .from('subscriptions')
      .update({ cancel_at_period_end: cancel, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspace.id);
    return NextResponse.json({ ok: true, cancelAtPeriodEnd: cancel });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Stripe request failed.' },
      { status: 502 },
    );
  }
}
