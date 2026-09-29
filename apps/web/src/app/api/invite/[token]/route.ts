import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, WORKSPACE_COOKIE } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Invite redeem (the cookie-setting half). Server Components cannot write
 * cookies, so the invite page hands signed-in users here: accept the token,
 * remember the joined workspace, land in the team — never in a stray
 * personal workspace.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = new URL(req.url).origin;
  const fail = (msg: string) =>
    NextResponse.redirect(`${origin}/invite/${token}?err=${encodeURIComponent(msg)}`);

  if (!UUID.test(token)) return fail('This invite link is broken. Ask for a fresh one.');

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const { data: workspaceId, error } = await sb.rpc('accept_invite', { p_token: token });
  let ws = typeof workspaceId === 'string' && workspaceId ? workspaceId : null;
  if (error) {
    if (!/already accepted/i.test(String(error?.message ?? ''))) {
      return fail(String(error?.message ?? 'The invite is invalid or expired.'));
    }
    // Already a member — find the invite's workspace so the landing sticks.
    const { data: inv } = await sb
      .from('invites')
      .select('workspace_id')
      .eq('token', token)
      .maybeSingle();
    ws = (inv as { workspace_id?: string } | null)?.workspace_id ?? null;
  }

  const res = NextResponse.redirect(`${origin}/calendar`);
  if (ws) {
    res.cookies.set(WORKSPACE_COOKIE, ws, {
      path: '/',
      maxAge: 365 * 24 * 3600,
      sameSite: 'lax',
      httpOnly: true,
    });
  }
  return res;
}
