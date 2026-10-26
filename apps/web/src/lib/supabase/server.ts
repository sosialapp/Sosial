import { cookies } from 'next/headers';
import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { WorkspaceInfo } from '../types';

export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server-side Supabase client. Cookies make this the same session the browser
 *  already has, so RLS sees the signed-in user. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot set cookies, the middleware refreshes
            // the session on the next request instead.
          }
        },
      },
    },
  );
}

/** Cookie remembering the last workspace the user actively joined (invite
 *  redeem). Preferred over the arbitrary first membership below. */
export const WORKSPACE_COOKIE = 'sosial_ws';

/** Signed-in user + workspace, bootstrapping the workspace on first login
 *  exactly like the mobile app's myWorkspace(). Null when signed out.
 *  Cached per request, the layout and every page call this, but the auth +
 *  member lookups run once per navigation. */
export const getWorkspaceContext = cache(async (): Promise<{
  user: User;
  workspace: WorkspaceInfo;
} | null> => {
  if (!hasSupabaseEnv()) return null;
  const sb = await createClient();
  // Cookie-only session read: no network round-trip (getUser() phones home
  // on every navigation). A forged cookie yields no rows under RLS, the
  // workspace bootstrap below FK-fails, and the caller redirects to login —
  // so skipping the phone-home costs nothing security-wise.
  const {
    data: { session },
  } = await sb.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  // Honor the last actively-joined workspace first: without this, an
  // invitee who already owns a personal workspace lands there after
  // redeeming and never sees the team that invited them.
  //
  // p109: the ACCOUNT column outranks this browser's cookie. The phone writes
  // the same column, so a switch on either client lands on both -- the cookie
  // alone could only ever speak for this browser, which is how the phone and
  // the web ended up reading different teams. The cookie stays as the fallback
  // for the request that performs a switch (it is set before the profile write
  // round-trips) and for rows that predate the column.
  try {
    const { data: prof } = await sb
      .from('profiles')
      .select('active_workspace_id')
      .eq('id', user.id)
      .maybeSingle();
    const accountWs =
      (prof as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;
    const cookieWs = (await cookies()).get(WORKSPACE_COOKIE)?.value ?? null;
    const preferred = accountWs ?? cookieWs;
    if (preferred) {
      const { data: pref } = await sb
        .from('workspace_members')
        .select('role, workspaces!inner(id, name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('workspace_id', preferred)
        .maybeSingle();
      const pw = pref?.workspaces as unknown as { id: string; name: string | null } | null;
      if (pw) {
        return {
          user,
          workspace: { id: String(pw.id), name: String(pw.name ?? 'My team'), role: (pref?.role ?? 'member') as WorkspaceInfo['role'] },
        };
      }
    }
  } catch {
    // Non-request contexts have no cookies, fall through to the default.
  }

  // Deterministic default: a team the user OWNS first, then the oldest
  // membership. PostgREST returns rows in arbitrary order without an explicit
  // ORDER BY, which drops multi-team users into a random team, and every team
  // is named "My team" so the wrong one is invisible.
  const { data: mems } = await sb
    .from('workspace_members')
    .select('role, workspaces!inner(id, name, owner_id)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  const rows = (mems ?? []) as unknown as {
    role: WorkspaceInfo['role'];
    workspaces: { id: string; name: string | null; owner_id: string | null } | null;
  }[];
  const pick = rows.find((r) => r.workspaces?.owner_id === user.id) ?? rows.find((r) => r.workspaces);
  if (pick?.workspaces) {
    return {
      user,
      workspace: {
        id: String(pick.workspaces.id),
        name: String(pick.workspaces.name ?? 'My team'),
        role: pick.role,
      },
    };
  }

  const { data: ws, error } = await sb
    .from('workspaces')
    .insert({ name: 'My team', owner_id: user.id })
    .select('id, name')
    .single();
  if (error || !ws) return null;
  await sb.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id: user.id,
    email: user.email ?? '',
    role: 'owner',
    status: 'active',
    all_channels: true,
  });
  return { user, workspace: { id: String(ws.id), name: String(ws.name ?? 'My team'), role: 'owner' } };
});
