import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Channel write access: owners and admins may connect/disconnect channels,
 * ordinary members may not. Every channel-mutating route and edge function
 * enforces this — the UIs hide the buttons, the servers reject the calls.
 * Returns an error message when the caller lacks access, null when allowed.
 */
export async function channelManageError(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return 'Sign in first.';
  const { data: mem } = await sb
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!mem) return 'Not a member of this workspace.';
  const role = (mem as { role?: string } | null)?.role;
  if (role !== 'owner' && role !== 'admin') {
    return 'Only owners and admins can connect channels.';
  }
  return null;
}
