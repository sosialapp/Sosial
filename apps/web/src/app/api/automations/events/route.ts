import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAutomationMember } from '@/lib/automations';

export const dynamic = 'force-dynamic';

/** Recent auto-reply activity, newest first, for the debug log. */
export async function GET(req: Request) {
  const caller = await requireAutomationMember();
  if ('error' in caller) return caller.error;
  const { ctx } = caller;

  const url = new URL(req.url);
  const requested = Number(url.searchParams.get('limit') ?? 100);
  const limit = Number.isFinite(requested) ? Math.min(200, Math.max(1, Math.round(requested))) : 100;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('auto_reply_events')
    .select(
      'id,workspace_id,rule_id,channel_id,target_kind,target_id,conversation_id,' +
        'external_post_id,external_id,author_key,target_preview,status,reason,reply_text,' +
        'job_id,created_at,sent_at',
    )
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return Response.json({ error: 'Could not load activity.' }, { status: 500 });
  return Response.json({ events: data ?? [] });
}
