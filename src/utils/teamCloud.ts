import { supabase, currentSession } from './supabase';
import { SOCIAL_META } from '../constants';

/**
 * Cloud team roster — the real, cross-device workspace membership. Mirrors the
 * web TeamManager exactly: members + pending invites from Supabase, invites via
 * create_invite, removal via remove_member, and per-member channel appointments
 * via set_member_grants (owner/admin only, enforced server-side).
 */

export type TeamRole = 'owner' | 'admin' | 'member';

export interface CloudMember {
  id: string;
  user_id: string | null;
  email: string;
  role: TeamRole;
  all_channels: boolean;
  /** providers this member is appointed to (empty when all_channels) */
  providers: string[];
}

export interface CloudInvite {
  id: string;
  email: string;
  role: TeamRole;
  all_channels: boolean;
  expires_at: string | null;
}

export interface CloudChannelOption {
  provider: string;
  external_id: string;
  label: string;
  avatar?: string;
}

export interface CloudTeam {
  workspaceId: string;
  workspaceName: string;
  myUserId: string;
  myRole: TeamRole;
  members: CloudMember[];
  invites: CloudInvite[];
  channels: CloudChannelOption[];
}

const PROVIDER_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SOCIAL_META as Record<string, { label?: string }>).map(([k, v]) => [k, v.label ?? k]),
);

function providerLabel(provider: string): string {
  const l = PROVIDER_LABEL[provider];
  if (!l) return provider;
  return l.charAt(0).toUpperCase() + l.slice(1);
}

export async function loadCloudTeam(): Promise<CloudTeam | null> {
  const session = await currentSession().catch(() => null);
  if (!session) return null;
  const sb = supabase();
  const wid = session.workspace.id;

  const [membersRes, invitesRes, grantsRes, channelsRes] = await Promise.all([
    sb
      .from('workspace_members')
      .select('id, user_id, email, role, all_channels')
      .eq('workspace_id', wid)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    sb
      .from('invites')
      .select('id, email, role, all_channels, expires_at')
      .eq('workspace_id', wid)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
    sb.from('member_channel_grants').select('member_id, provider'),
    sb
      .from('connected_channels')
      .select('provider, external_id, display_name, handle, metadata')
      .eq('workspace_id', wid)
      .eq('status', 'connected'),
  ]);

  const grants = (grantsRes.data ?? []) as unknown as { member_id: string; provider: string }[];
  const channelRows = (channelsRes.data ?? []) as unknown as {
    provider: string;
    external_id: string;
    display_name: string | null;
    handle: string | null;
    metadata: Record<string, unknown> | null;
  }[];
  const channels: CloudChannelOption[] = channelRows.map((c) => {
    const avatar = typeof c.metadata?.avatar === 'string' ? (c.metadata.avatar as string) : undefined;
    return {
      provider: c.provider,
      external_id: c.external_id,
      label: c.display_name || c.handle || providerLabel(c.provider),
      avatar,
    };
  });

  const memberRows = (membersRes.data ?? []) as unknown as {
    id: string;
    user_id: string | null;
    email: string;
    role: TeamRole;
    all_channels: boolean;
  }[];
  const members: CloudMember[] = memberRows.map((m) => ({
    ...m,
    providers: grants.filter((g) => g.member_id === m.id).map((g) => g.provider),
  }));

  return {
    workspaceId: wid,
    workspaceName: session.workspace.name,
    myUserId: session.user.id,
    myRole: session.workspace.role,
    members,
    invites: (invitesRes.data ?? []) as CloudInvite[],
    channels,
  };
}

export async function createInvite(
  workspaceId: string,
  email: string,
  role: 'member' | 'admin',
  allChannels: boolean,
): Promise<void> {
  const { error } = await supabase().rpc('create_invite', {
    p_workspace_id: workspaceId,
    p_email: email.trim(),
    p_role: role,
    p_all_channels: allChannels,
  });
  if (error) throw new Error(error.message);
}

export async function removeMember(workspaceId: string, userId: string | null): Promise<void> {
  if (!userId) throw new Error('This teammate has not joined yet — cancel the invite instead.');
  const { error } = await supabase().rpc('remove_member', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function setMemberGrants(
  memberId: string,
  providers: string[],
  allChannels: boolean,
): Promise<void> {
  const { error } = await supabase().rpc('set_member_grants', {
    p_member_id: memberId,
    p_providers: providers,
    p_all_channels: allChannels,
  });
  if (error) throw new Error(error.message);
}

/* ---------------- permission mirror (matches the backend) ---------------- */

export interface Actor {
  userId: string | null;
  role: TeamRole;
}

export function canRemoveMember(actor: Actor, target: CloudMember): boolean {
  if (target.user_id && target.user_id === actor.userId) return false;
  if (actor.role === 'owner') return target.role !== 'owner';
  if (actor.role === 'admin') return target.role === 'member';
  return false;
}

export function canAssignChannels(actor: Actor, target: CloudMember): boolean {
  if (target.role === 'owner') return actor.role === 'owner' && target.user_id === actor.userId;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') return target.role === 'member';
  return false;
}

export function canChangeRole(actor: Actor, target: CloudMember): boolean {
  if (actor.role !== 'owner') return false;
  return target.role !== 'owner';
}

export function channelsSummary(m: CloudMember, channels: CloudChannelOption[]): string {
  if (m.all_channels) return 'All channels';
  if (m.providers.length === 0) return 'No channels yet';
  const labels = m.providers.map((p) => {
    const c = channels.find((x) => x.provider === p);
    return c ? c.label : providerLabel(p);
  });
  return labels.join(', ');
}
