import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getEntitlement } from '@/lib/billing/entitlement';
import { PLANS } from '@/lib/billing/plans';
import { applyWatermark } from '@/lib/watermark';

export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Server-side watermarking for studio exports.
 *
 * The browser renders the design WITHOUT any watermark decision and posts the
 * raw PNG here. The plan + the workspace's `show_watermark` flag are read from
 * the database (never trusted from the client): free is always watermarked, and
 * a paid workspace's choice is honoured. The composited PNG is the only bytes
 * the client ever receives — there is nothing to strip with devtools.
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return NextResponse.json({ error: 'Empty image.' }, { status: 400 });
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is too large to export.' }, { status: 413 });
  }

  const ent = await getEntitlement(ctx.workspace.id);
  const required = PLANS[ent.plan].limits.watermarkRequired;

  let show = true;
  try {
    const { data } = await supabaseAdmin()
      .from('workspaces')
      .select('show_watermark')
      .eq('id', ctx.workspace.id)
      .maybeSingle();
    show = data?.show_watermark ?? true;
  } catch {
    // Fall back to requiring it — never hand back a clean file by accident.
    show = true;
  }

  const effective = required || show;
  if (!effective) {
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const out = await applyWatermark(buf);
    return new NextResponse(new Uint8Array(out), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  } catch {
    // Fail closed: no un-watermarked fallback when the mark is required.
    return NextResponse.json({ error: 'Could not watermark the export. Try again.' }, { status: 500 });
  }
}
