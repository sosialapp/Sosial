import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAutomationAdmin } from '@/lib/automations';

export const dynamic = 'force-dynamic';

/**
 * Master switches. `paused` stops every rule without deleting anything, and
 * `dry_run` turns the whole workspace into log-only mode. Both are re-read by
 * the worker at send time, so pausing also cancels replies already queued.
 */
export async function PATCH(req: Request) {
  const caller = await requireAutomationAdmin();
  if ('error' in caller) return caller.error;
  const { ctx } = caller;

  let body: { paused?: unknown; dry_run?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { workspace_id: ctx.workspace.id };
  if (typeof body.paused === 'boolean') patch.paused = body.paused;
  if (typeof body.dry_run === 'boolean') patch.dry_run = body.dry_run;
  if (Object.keys(patch).length === 1) {
    return Response.json({ error: 'Send paused and/or dry_run as booleans.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('auto_reply_settings')
    .upsert(patch, { onConflict: 'workspace_id' })
    .select('workspace_id,paused,dry_run')
    .single();

  if (error || !data) {
    return Response.json({ error: 'Could not save the settings.' }, { status: 500 });
  }
  return Response.json({ settings: data });
}
