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
            // Server Components cannot set cookies — the middleware refreshes
            // the session on the next request instead.
          }
        },
      },
    },
  );
}

/** Signed-in user + workspace, bootstrapping the workspace on first login
 *  exactly like the mobile app's myWorkspace(). Null when signed out.
 *  Cached per request — the layout and every page call this, but the auth +
 *  member lookups run once per navigation. */
export const getWorkspaceContext = cache(async (): Promise<{
  user: User;
  workspace: WorkspaceInfo;
} | null> => {
  if (!hasSupabaseEnv()) return null;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: mem } = await sb
    .from('workspace_members')
    .select('role, workspaces!inner(id, name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (mem?.workspaces) {
    const w = mem.workspaces as unknown as { id: string; name: string | null };
    return {
      user,
      workspace: { id: String(w.id), name: String(w.name ?? 'My team'), role: mem.role as WorkspaceInfo['role'] },
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
