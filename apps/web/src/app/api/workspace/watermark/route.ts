import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getEntitlement } from '@/lib/billing/entitlement';
import { PLANS } from '@/lib/billing/plans';

export const runtime = 'nodejs';

/**
 * Toggle the Sosial watermark for the workspace. The plan gate is enforced
 * HERE, server-side: watermark-required plans (Free) are always on, so a
 * request to turn it off is rejected rather than trusted. The DB trigger in
 * p28 is the backstop.
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json({ error: 'Only an owner can change this setting.' }, { status: 403 });
  }

  let body: { show?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const show = body.show === true;

  const ent = await getEntitlement(ctx.workspace.id);
  const required = PLANS[ent.plan].limits.watermarkRequired;
  if (required && !show) {
    return NextResponse.json(
      { error: 'The Sosial watermark is required on the Free plan. Upgrade to remove it.' },
      { status: 402 },
    );
  }

  try {
    const { error } = await supabaseAdmin()
      .from('workspaces')
      .update({ show_watermark: show })
      .eq('id', ctx.workspace.id);
    if (error) throw error;
  } catch {
    return NextResponse.json({ error: 'Could not save the setting. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, showWatermark: show });
}
