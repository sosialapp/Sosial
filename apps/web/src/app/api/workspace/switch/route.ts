import { NextResponse } from 'next/server';
import { createClient, WORKSPACE_COOKIE } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspace/switch { workspace_id } — sticks the session to one
 * workspace. Verified against active membership; unknown workspaces are
 * rejected, never defaulted.
 */
export async function POST(req: Request) {
  let workspaceId: unknown;
  try {
    workspaceId = ((await req.json()) as { workspace_id?: unknown }).workspace_id;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  if (typeof workspaceId !== 'string' || !workspaceId) {
    return NextResponse.json({ error: 'workspace_id required.' }, { status: 400 });
  }
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: mem } = await sb
    .from('workspace_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .maybeSingle();
  if (!mem) {
    return NextResponse.json({ error: 'Not a member of that workspace.' }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WORKSPACE_COOKIE, workspaceId, {
    path: '/',
    maxAge: 365 * 24 * 3600,
    sameSite: 'lax',
    httpOnly: true,
  });
  return res;
}
