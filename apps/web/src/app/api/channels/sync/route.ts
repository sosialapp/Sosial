import { NextResponse } from 'next/server';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/channels/sync — on-demand health check. Enqueues refresh_token
 * jobs (the worker marks auth-dead channels expired) plus an avatar refresh,
 * then the UI polls a few times while the worker catches up.
 */
export async function POST() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (ctx.workspace.role !== 'owner' && ctx.workspace.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can sync channels.' },
      { status: 403 },
    );
  }
  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('recheck-channels', {
    body: { workspace_id: ctx.workspace.id },
  });
  const payload = (data ?? {}) as { queued_refresh?: number; error?: string };
  if (error || payload.error) {
    return NextResponse.json(
      { error: payload.error ?? error?.message ?? 'Could not start the health check.' },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, queued_refresh: payload.queued_refresh ?? 0 });
}
