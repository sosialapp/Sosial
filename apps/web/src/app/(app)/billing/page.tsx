import { redirect } from 'next/navigation';
import BillingPanel from '@/components/BillingPanel';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getEntitlement } from '@/lib/billing/entitlement';
import { getUsage } from '@/lib/billing/usage';
import { pricesConfigured } from '@/lib/billing/stripe';
import { PLANS } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

/** Billing: current plan, interval, price, period, usage, changes + cancellation. */
export default async function BillingPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');

  const entitlement = await getEntitlement(ctx.workspace.id);
  const usage = await getUsage(ctx.workspace.id, entitlement.plan);

  let showWatermark = true;
  try {
    const { data } = await supabaseAdmin()
      .from('workspaces')
      .select('show_watermark')
      .eq('id', ctx.workspace.id)
      .maybeSingle();
    showWatermark = data?.show_watermark ?? true;
  } catch {
    showWatermark = true;
  }
  const watermarkRequired = PLANS[entitlement.plan].limits.watermarkRequired;

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Workspace</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Billing</h1>
      <p className="mt-1 text-sm text-muted">
        {ctx.workspace.name} · plan, invoices and usage
      </p>
      <div className="mt-4 max-w-2xl">
        <BillingPanel
          entitlement={{
            plan: entitlement.plan,
            billingInterval: entitlement.billingInterval,
            status: entitlement.status,
            currentPeriodStart: entitlement.currentPeriodStart,
            currentPeriodEnd: entitlement.currentPeriodEnd,
            cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
            active: entitlement.active,
          }}
          usage={usage}
          stripeReady={pricesConfigured()}
          showWatermark={showWatermark}
          watermarkRequired={watermarkRequired}
        />
      </div>
    </div>
  );
}
