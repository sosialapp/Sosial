import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getWorkspaceContext, WORKSPACE_COOKIE } from '@/lib/supabase/server';

/** Create a new team (workspace) owned by the caller, pin the sosial_ws
 *  cookie to it, and let the client refresh into it. The DB trigger
 *  enforce_workspace_limit caps how many teams the caller may own by plan
 *  (free/solo 1 · team 3 · business 6 · ultimate unlimited) and raises
 *  WORKSPACE_LIMIT — surfaced here as a 403 with the DB's message. */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = await (await import('@/lib/supabase/server')).createClient();
  let name = 'New team';
  try {
    const body = (await req.json()) as { name?: unknown };
    const trimmed = typeof body.name === 'string' ? body.name.trim() : '';
    if (trimmed) name = trimmed.slice(0, 80);
  } catch {
    /* no body — default name */
  }
  const { data: ws, error } = await sb
    .from('workspaces')
    .insert({ name, owner_id: ctx.user.id })
    .select('id, name')
    .single();
  if (error || !ws) {
    const msg = error?.message ?? 'Could not create the team.';
    const limited = msg.startsWith('WORKSPACE_LIMIT');
    return NextResponse.json(
      { error: limited ? msg.replace(/^WORKSPACE_LIMIT:\s*/, '') : msg },
      { status: limited ? 403 : 500 },
    );
  }
  const ins = await sb.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id: ctx.user.id,
    email: ctx.user.email ?? '',
    role: 'owner',
    status: 'active',
    all_channels: true,
  });
  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }
  (await cookies()).set(WORKSPACE_COOKIE, ws.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ id: ws.id, name: ws.name });
}
