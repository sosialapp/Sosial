import { redirect } from 'next/navigation';
import TeamManager from '@/components/TeamManager';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Workspace roster: members, pending invites, invite + remove (owner/admin). */
export default async function TeamPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [membersRes, invitesRes, grantsRes, channelsRes] = await Promise.all([
    sb
      .from('workspace_members')
      .select('id, user_id, email, role, all_channels')
      .eq('workspace_id', ctx.workspace.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    sb
      .from('invites')
      .select('id, email, role, all_channels, expires_at')
      .eq('workspace_id', ctx.workspace.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
    sb.from('member_channel_grants').select('member_id, provider'),
    sb
      .from('connected_channels')
      .select('provider, external_id, display_name, handle, metadata')
      .eq('workspace_id', ctx.workspace.id)
      .eq('status', 'connected'),
  ]);

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Workspace</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Team</h1>
      <p className="mt-1 text-sm text-muted">
        {ctx.workspace.name} · {(membersRes.data ?? []).length} member
        {(membersRes.data ?? []).length === 1 ? '' : 's'}
      </p>
      <div className="mt-4">
        <TeamManager
          workspaceId={ctx.workspace.id}
          myUserId={ctx.user.id}
          myRole={ctx.workspace.role}
          members={membersRes.data ?? []}
          invites={invitesRes.data ?? []}
          grants={(grantsRes.data ?? []) as { member_id: string; provider: string }[]}
          channels={(channelsRes.data ?? []) as {
            provider: string;
            external_id: string;
            display_name: string | null;
            handle: string | null;
            metadata: Record<string, unknown> | null;
          }[]}
        />
      </div>
    </div>
  );
}
