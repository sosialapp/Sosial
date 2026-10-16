import { redirect } from 'next/navigation';
import ApiKeysManager from '@/components/ApiKeysManager';
import McpSection from '@/components/McpSection';
import TeamManager from '@/components/TeamManager';
import TeamPicker from '@/components/TeamPicker';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';
import { PLANS } from '@/lib/billing/plans';

export const metadata = { title: 'Team' };


export const dynamic = 'force-dynamic';

/** Workspace roster: members, pending invites, invite + remove (owner/admin). */
export default async function TeamPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const ent = await getEntitlement(ctx.workspace.id);
  const [membersRes, invitesRes, grantsRes, channelsRes] = await Promise.all([
    sb
      .from('workspace_members')
      .select('id, user_id, email, role, all_channels')
      .eq('workspace_id', ctx.workspace.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    sb
      .from('invites')
      .select('id, email, role, all_channels, expires_at, token, emailed_at')
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

  const members = membersRes.data ?? [];
  const memberIds = members
    .map((m: { user_id: string | null }) => m.user_id)
    .filter((id): id is string => !!id);
  const { data: profRows } = memberIds.length
    ? await sb.from('profiles').select('id, avatar_url').in('id', memberIds)
    : { data: [] as { id: string; avatar_url: string | null }[] };
  const memberAvatars: Record<string, string> = Object.fromEntries(
    ((profRows ?? []) as { id: string; avatar_url: string | null }[])
      .filter((p) => p.avatar_url)
      .map((p) => [p.id, p.avatar_url as string]),
  );
  const { data: wsRow } = await sb
    .from('workspaces')
    .select('avatar_url')
    .eq('id', ctx.workspace.id)
    .maybeSingle();
  const { data: memberships } = await sb
    .from('workspace_members')
    .select('role, workspaces!inner(id, name, avatar_url)')
    .eq('user_id', ctx.user.id)
    .eq('status', 'active');
  const workspaces = (
    ((memberships ?? []) as unknown as {
      role: string;
      workspaces: { id: string; name: string | null; avatar_url: string | null };
    }[])
  )
    .map((m) => ({
      id: String(m.workspaces.id),
      name: String(m.workspaces.name ?? 'My team'),
      role: String(m.role),
      avatar_url: (m.workspaces.avatar_url ?? null) as string | null,
    }))
    .sort((a, b) => (b.id === ctx.workspace.id ? 1 : 0) - (a.id === ctx.workspace.id ? 1 : 0));

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Workspace</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Team</h1>
      <TeamPicker
        current={{
          id: ctx.workspace.id,
          name: ctx.workspace.name,
          role: ctx.workspace.role,
          avatar_url: workspaces.find((w) => w.id === ctx.workspace.id)?.avatar_url ?? null,
        }}
        memberCount={members.length}
        planLabel={PLANS[ent.plan].label}
        workspaces={
          workspaces.some((w) => w.id === ctx.workspace.id)
            ? workspaces
            : [
                ...workspaces,
                { id: ctx.workspace.id, name: ctx.workspace.name, role: ctx.workspace.role },
              ]
        }
      />
      <div className="mt-4 space-y-4">
        <TeamManager
          workspaceId={ctx.workspace.id}
          workspaceName={ctx.workspace.name}
          workspaceAvatar={(wsRow as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          memberAvatars={memberAvatars}
          myUserId={ctx.user.id}
          myRole={ctx.workspace.role}
          members={members}
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
        <McpSection
          canManage={ctx.workspace.role === 'owner' || ctx.workspace.role === 'admin'}
        />
        <ApiKeysManager
          canManage={ctx.workspace.role === 'owner' || ctx.workspace.role === 'admin'}
        />
      </div>
    </div>
  );
}
