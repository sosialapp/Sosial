import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { stripeConfigured, stripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

/** Stripe-hosted billing portal: invoices, payment method, cancellation. */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 });
  }

  const admin = supabaseAdmin();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  try {
    const s = stripe();
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
    const origin = req.headers.get('origin') ?? new URL(req.url).origin;
    const session = await s.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Stripe request failed.' },
      { status: 502 },
    );
  }
}
