import { getEntitlement } from '@/lib/billing/entitlement';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { unauthorized, verifyApiKey } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Auth probe — Zapier uses this as its "test authentication" call. */
export async function GET(req: Request) {
  const ctx = await verifyApiKey(req);
  if (!ctx) return unauthorized();
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('workspaces')
    .select('id, name')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  const row = (data ?? { id: ctx.workspaceId, name: null }) as { id: string; name: string | null };
  const ent = await getEntitlement(ctx.workspaceId);
  return Response.json({
    workspace: { id: row.id, name: row.name, plan: ent.plan },
  });
}
