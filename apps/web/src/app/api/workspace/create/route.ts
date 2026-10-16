import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getWorkspaceContext, WORKSPACE_COOKIE } from '@/lib/supabase/server';

/** Create a new team (workspace) owned by the caller, pin the sosial_ws
 *  cookie to it, and let the client refresh into it. Teams are a paid-plan
 *  feature: Team, Business and Ultimate only. The route pre-checks the plan
 *  (clear 403 + upgrade message) and the DB trigger enforce_workspace_limit
 *  stays the backstop (free/solo 1 · team 3 · business 6 · ultimate
 *  unlimited owned workspaces). */

/** Mirrors plan_limits.workspaces (p27/p31/p65). */
const WORKSPACE_LIMITS: Record<string, number | null> = {
  free: 1,
  solo: 1,
  team: 3,
  business: 6,
  ultimate: null,
};

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
    /* no body, default name */
  }

  // Plan gate, same resolution as the trigger: the caller's best active
  // plan across the workspaces they already own (else free).
  const { data: owned } = await sb
    .from('workspaces')
    .select('id')
    .eq('owner_id', ctx.user.id);
  const ownedIds = (owned ?? []).map((w) => w.id);
  let plan = 'free';
  if (ownedIds.length) {
    const { data: subs } = await sb
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .in('workspace_id', ownedIds);
    const active = (subs ?? []).filter((s) => {
      if (s.plan === 'free') return false;
      // Ultimate is lifetime: no interval and no period end, so it never
      // matches the paid-status test. Mirrors enforce_workspace_limit (p31).
      if (s.plan === 'ultimate' && s.status === 'lifetime') return true;
      return (
        ['active', 'trialing', 'past_due'].includes(s.status ?? '') &&
        (!s.current_period_end || Date.parse(s.current_period_end) > Date.now())
      );
    });
    const rank: Record<string, number> = { business: 3, team: 2, solo: 1, ultimate: 4 };
    plan =
      active.sort((a, b) => (rank[b.plan] ?? 0) - (rank[a.plan] ?? 0))[0]?.plan ?? 'free';
  }
  const limit = WORKSPACE_LIMITS[plan] ?? 1;
  if (limit !== null && ownedIds.length >= limit) {
    return NextResponse.json(
      {
        error:
          plan === 'free' || plan === 'solo'
            ? 'Creating teams needs a Team, Business or Ultimate plan, upgrade in Billing to create your first team.'
            : `Your plan allows ${limit} teams, upgrade to create more.`,
      },
      { status: 403 },
    );
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
