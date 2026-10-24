'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AtSign, Camera, Crown, Link2, LogOut, Mail, Pencil, ShieldCheck, Trash2, UserPlus, UserRound, X,
} from 'lucide-react';
import ChannelScopePills from '@/components/ChannelScopePills';
import SegmentedPills from '@/components/ui/segmented-pills';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import { createClient } from '@/lib/supabase/client';
import { useSignedUrl } from '@/lib/useSignedUrl';
import { edgeErrorMessage } from '@/lib/functions';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';

export interface TeamMemberRow {
  id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'admin' | 'member';
  all_channels: boolean;
}

export interface TeamInviteRow {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  all_channels: boolean;
  expires_at: string | null;
  /** Bearer redeem token + delivery stamp (for the copy-link fallback). */
  token: string;
  emailed_at: string | null;
}

export interface TeamChannelRow {
  provider: string;
  external_id: string;
  display_name: string | null;
  handle: string | null;
  metadata: Record<string, unknown> | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  tiktok: 'TikTok',
  x: 'X',
  bluesky: 'Bluesky',
  linkedin: 'LinkedIn',
  mastodon: 'Mastodon',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
};

function channelLabel(c: TeamChannelRow): string {
  return c.display_name || c.handle || PROVIDER_LABEL[c.provider] || c.provider;
}

/** Signed-URL member photo from the private avatars bucket. */
function MemberAvatar({ path, email }: { path?: string; email: string }) {
  const url = useSignedUrl(path, 'avatars', 3600);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-full border border-line object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#191512] font-display text-sm font-extrabold text-white">
      {(email[0] ?? '?').toUpperCase()}
    </div>
  );
}

/** Roster + invites, following the mobile permission model: owners manage
 *  everyone (never another owner), admins manage members only. Owners appoint
 *  which connected accounts each teammate may post to; only the owner can
 *  disconnect an account (that lives on the Channels page). */
export default function TeamManager({
  workspaceId,
  workspaceName,
  workspaceAvatar,
  memberAvatars,
  myUserId,
  myRole,
  members,
  invites,
  grants,
  channels,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaceAvatar: string | null;
  memberAvatars: Record<string, string>;
  myUserId: string;
  myRole: 'owner' | 'admin' | 'member';
  members: TeamMemberRow[];
  invites: TeamInviteRow[];
  grants: { member_id: string; provider: string }[];
  channels: TeamChannelRow[];
}) {
  const router = useRouter();
  const t = useT(appMessages);
  const [draftName, setDraftName] = useState(workspaceName);
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editingName) setDraftName(workspaceName);
  }, [workspaceName, editingName]);
  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [inviteAll, setInviteAll] = useState(true);
  const [inviteSel, setInviteSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(members.length <= 1);

  const [assigning, setAssigning] = useState<string | null>(null);
  const [gAll, setGAll] = useState(true);
  const [gSel, setGSel] = useState<string[]>([]);
  const [teamAvatarPath, setTeamAvatarPath] = useState<string | null>(workspaceAvatar);
  const [teamAvatarFailed, setTeamAvatarFailed] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);

  /** Signed URL for the stored team picture (retried, so it shows on arrival). */
  const teamAvatarUrl = useSignedUrl(teamAvatarPath, 'avatars', 3600);
  useEffect(() => setTeamAvatarFailed(false), [teamAvatarUrl]);

  const canManage = myRole === 'owner' || myRole === 'admin';
  const canRemove = (m: TeamMemberRow): boolean => {
    if (m.user_id === myUserId) return false;
    if (myRole === 'owner') return m.role !== 'owner';
    if (myRole === 'admin') return m.role === 'member';
    return false;
  };
  const canAssign = (m: TeamMemberRow): boolean => {
    if (m.role === 'owner') return false;
    if (myRole === 'owner') return true;
    if (myRole === 'admin') return m.role === 'member';
    return false;
  };
  /** Who may have their role changed, and why it mirrors removal power. */
  const canChangeRole = (m: TeamMemberRow): boolean => {
    if (m.user_id === myUserId) return false;
    if (myRole === 'owner') return m.role !== 'owner';
    if (myRole === 'admin') return m.role === 'member';
    return false;
  };
  const providersOf = (m: TeamMemberRow): string[] =>
    grants.filter((g) => g.member_id === m.id).map((g) => g.provider);
  const summary = (m: TeamMemberRow): string => {
    if (m.all_channels) return t('tmAllChannels');
    const ps = providersOf(m);
    if (ps.length === 0) return t('tmNoAccounts');
    return ps.map((p) => PROVIDER_LABEL[p] ?? p).join(', ');
  };
  const openAssign = (m: TeamMemberRow) => {
    if (assigning === m.id) {
      setAssigning(null);
      return;
    }
    const ps = providersOf(m);
    setGAll(m.all_channels || ps.length === 0);
    setGSel(ps);
    setAssigning(m.id);
  };
  const saveGrants = async (m: TeamMemberRow) => {
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('set_member_grants', {
        p_member_id: m.id,
        p_providers: gAll ? [] : gSel,
        p_all_channels: gAll,
      });
      if (error) throw new Error(error.message);
      setAssigning(null);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('tmErrSaveGrants'));
    } finally {
      setBusy(false);
    }
  };

  async function saveName() {
    const name = draftName.trim() || t('tmTeamPh');
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.from('workspaces').update({ name }).eq('id', workspaceId);
      if (error) throw new Error(error.message);
      setDraftName(name);
      setEditingName(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('tmErrSaveName'));
    } finally {
      setBusy(false);
    }
  }

  const startNameEdit = () => {
    setDraftName(workspaceName);
    setErr(null);
    setEditingName(true);
  };
  const cancelNameEdit = () => {
    setDraftName(workspaceName);
    setErr(null);
    setEditingName(false);
  };

  /** Upload → compress server-side → refresh. Owners and admins only. */
  async function changeTeamAvatar(file: File) {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setErr(null);
    setAvatarMsg(null);
    try {
      const b64 = await fileToAvatarDataUrl(file);
      if (!b64) throw new Error(t('tmImgFormat'));
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('team-avatar', {
        body: { workspace_id: workspaceId, image_base64: b64 },
      });
      if (error) throw new Error((await edgeErrorMessage(error)) ?? t('tmErrAvatarUpdate'));
      const msg = (data as { error?: string } | null)?.error;
      if (msg) throw new Error(msg);
      setTeamAvatarPath((data as { avatar_url?: string }).avatar_url ?? null);
      setAvatarMsg(t('tmAvatarSave'));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('tmErrAvatarUpdate'));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeTeamAvatar() {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setErr(null);
    setAvatarMsg(null);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('team-avatar', {
        body: { workspace_id: workspaceId, remove: true },
      });
      if (error) throw new Error((await edgeErrorMessage(error)) ?? t('tmErrAvatarRemove'));
      const msg = (data as { error?: string } | null)?.error;
      if (msg) throw new Error(msg);
      setTeamAvatarPath(null);
      setAvatarMsg(t('tmAvatarRemove'));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('tmErrAvatarRemove'));
    } finally {
      setAvatarBusy(false);
    }
  }

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErr(t('tmErrInviteEmail'));
      return;
    }
    setBusy(true);
    setErr(null);
    setInviteLink(null);
    try {
      const sb = createClient();
      // Row + email go through send-invite, the raw create_invite RPC
      // writes the row but sends nothing, so invitees never hear about it.
      const { data, error } = await sb.functions.invoke('send-invite', {
        body: {
          workspace_id: workspaceId,
          email: email.trim(),
          role,
          all_channels: inviteAll,
          providers: inviteAll ? [] : inviteSel,
        },
      });
      if (error) throw new Error((await edgeErrorMessage(error)) ?? error.message);
      setEmail('');
      setRole('member');
      setInviteAll(true);
      setInviteSel([]);
      const url = (data as { invite_url?: unknown } | null)?.invite_url;
      if (
        (data as { already_registered?: unknown } | null)?.already_registered === true &&
        typeof url === 'string' &&
        url
      ) {
        // Already on Sosial, no email can reach them, hand over the link.
        setInviteLink(url);
      }
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('tmErrInviteSend'));
    } finally {
      setBusy(false);
    }
  };

  const cancelPendingInvite = async (inv: TeamInviteRow) => {
    if (!window.confirm(fill(t('tmWithdrawQ'), { email: inv.email }))) return;
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('cancel_invite', { p_invite_id: inv.id });
      if (error) throw new Error(error.message);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('tmErrCancelInvite'));
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async (m: TeamMemberRow, role: 'member' | 'admin') => {
    if (role === m.role) return;
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('set_member_role', { p_member_id: m.id, p_role: role });
      if (error) throw new Error(error.message);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('tmErrChangeRole'));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!window.confirm(t('tmLeaveQ'))) return;
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('leave_workspace', { p_workspace_id: workspaceId });
      if (error) throw new Error(error.message);
      router.push('/dashboard');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('tmErrLeave'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: TeamMemberRow) => {
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('remove_member', {
        p_workspace_id: workspaceId,
        p_user_id: m.user_id,
      });
      if (error) throw new Error(error.message);
      setConfirmRemove(null);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('tmErrRemove'));
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = (r: string) =>
    r === 'member' ? t('roleMember') : r === 'admin' ? t('roleAdmin') : r === 'owner' ? t('roleOwner') : r;
  const RoleIcon = ({ r }: { r: string }) => {
    const Icon = r === 'owner' ? Crown : r === 'admin' ? ShieldCheck : UserRound;
    return <Icon className="h-3 w-3" aria-hidden="true" />;
  };
  const leads = members.filter((m) => m.role === 'owner' || m.role === 'admin').length;

  /* ------------------------------ team identity ------------------------------ */

  const identity = (
    <section className="card flex flex-wrap items-center gap-4 p-4 sm:p-5" aria-label={t('tmTeamNameAria')}>
      <span className="relative shrink-0">
        {teamAvatarUrl && !teamAvatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={teamAvatarUrl}
            alt={t('tmTeamPicture')}
            onError={() => setTeamAvatarFailed(true)}
            className="h-14 w-14 rounded-2xl object-cover ring-1 ring-line"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink font-display text-xl font-extrabold text-bone">
            {(draftName.trim() || workspaceName || 'T')[0].toUpperCase()}
          </span>
        )}
        {avatarBusy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40" aria-hidden="true">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
        ) : null}
        {canManage ? (
          <label
            className="absolute -right-1.5 -bottom-1.5 grid h-6 w-6 cursor-pointer place-items-center rounded-full border-2 border-card bg-ink text-bone transition hover:scale-105"
            title={teamAvatarUrl ? t('tmChange') : t('tmAddPhoto')}
          >
            <Camera className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">{teamAvatarUrl ? t('tmChange') : t('tmAddPhoto')}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void changeTeamAvatar(f);
              }}
            />
          </label>
        ) : null}
      </span>

      <div className="min-w-0 flex-1">
        {editingName ? (
          <div className="flex max-w-md flex-col gap-2 sm:flex-row">
            <input
              ref={nameRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveName();
                }
                if (e.key === 'Escape') cancelNameEdit();
              }}
              placeholder={t('tmTeamPh')}
              aria-label={t('tmTeamNameAria')}
              className="field min-w-0 flex-1"
            />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void saveName()} className="btn btn-primary btn-sm">
                {busy ? t('tmSaving') : t('tmSave')}
              </button>
              <button type="button" disabled={busy} onClick={cancelNameEdit} className="btn btn-sm">
                {t('tmCancel')}
              </button>
            </div>
          </div>
        ) : canManage ? (
          <button
            type="button"
            onClick={startNameEdit}
            title={t('tmRenameTeam')}
            aria-label={t('tmRenameTeam')}
            className="group flex max-w-full items-center gap-2 rounded-lg text-left"
          >
            <span className="truncate font-display text-xl font-extrabold tracking-tight">{workspaceName}</span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-faint transition group-hover:text-ink" aria-hidden="true" />
          </button>
        ) : (
          <p className="truncate font-display text-xl font-extrabold tracking-tight">{workspaceName}</p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span>
            <b className="font-bold text-ink">{members.length}</b> {t('tmMembersLbl').toLowerCase()}
          </span>
          <span>
            <b className="font-bold text-ink">{leads}</b> {t('tmLeadsLbl').toLowerCase()}
          </span>
          <span>
            <b className="font-bold text-ink">{invites.length}</b> {t('tmPendingShort').toLowerCase()}
          </span>
          {canManage && teamAvatarUrl ? (
            <button type="button" onClick={() => void removeTeamAvatar()} className="font-bold text-faint transition hover:text-[#9F2F2D]">
              {t('tmRemove')} photo
            </button>
          ) : null}
        </p>
        {avatarMsg ? <p className="mt-1 text-xs font-bold text-[#346538] dark:text-[#8fd0a0]">{avatarMsg}</p> : null}
      </div>
    </section>
  );

  /* -------------------------------- invite -------------------------------- */

  const invitePanel = canManage && inviteOpen ? (
    <form onSubmit={invite} className="space-y-3 border-b border-line bg-surface/50 px-5 py-4" aria-label={t('tmInviteTeammate')}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('tmEmailPh')}
            type="email"
            autoCapitalize="none"
            className="field !pl-10"
            aria-label={t('tmEmailAria')}
            autoFocus
          />
        </div>
        <SegmentedPills
          ariaLabel={t('tmRole')}
          value={role}
          onChange={setRole}
          className="shrink-0"
          options={[
            { value: 'member', label: t('roleMember') },
            { value: 'admin', label: t('roleAdmin') },
          ]}
        />
        <button type="submit" disabled={busy} className="btn btn-primary shrink-0 justify-center">
          {busy ? t('tmSending') : t('tmSendInvite')}
        </button>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold text-muted">{t('tmAccountsFor')}</p>
        <ChannelScopePills
          channels={channels}
          all={inviteAll}
          selected={inviteSel}
          onChange={(all, sel) => {
            setInviteAll(all);
            setInviteSel(sel);
          }}
        />
        {channels.length === 0 ? <p className="mt-2 text-xs text-muted">{t('tmNoChannelsYet')}</p> : null}
      </div>
      {inviteLink ? (
        <div className="rounded-2xl bg-card p-3 text-sm ring-1 ring-line">
          <p className="font-bold">{t('tmAlreadyOnSosial')}</p>
          <p className="mt-1 break-all text-xs text-muted">{inviteLink}</p>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(inviteLink)} className="btn btn-ghost btn-sm mt-2">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {t('tmCopyLink')}
          </button>
        </div>
      ) : null}
    </form>
  ) : null;

  /* ------------------------------- pending -------------------------------- */

  const pending =
    invites.length > 0 ? (
      <div className="border-t border-line">
        <p className="bg-surface/50 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
          {t('tmPendingInvites')} · {invites.length}
        </p>
        <ul className="divide-y divide-line-soft">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-line text-faint">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{inv.email}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1 font-bold">
                    <RoleIcon r={inv.role} />
                    {roleLabel(inv.role)}
                  </span>
                  {inv.expires_at ? (
                    // Server and browser locales can format the date differently.
                    <span suppressHydrationWarning>
                      {fill(t('tmExpires'), {
                        date: new Date(inv.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                      })}
                    </span>
                  ) : null}
                  {inv.emailed_at ? (
                    <span className="text-faint">{t('tmInviteSent')}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(`https://sosial.app/invite/${inv.token}`)}
                      className="font-bold text-accent-ink hover:underline"
                    >
                      {t('tmEmailPending')}
                    </button>
                  )}
                </span>
              </span>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => void cancelPendingInvite(inv)}
                  disabled={busy}
                  aria-label={fill(t('tmCancelInviteAria'), { email: inv.email })}
                  title={t('tmCancelInvite')}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-[#FDEBEC] hover:text-[#9F2F2D] disabled:opacity-40 dark:hover:bg-[#2c1b1b]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  /* ------------------------------- members -------------------------------- */

  const roster = (
    <section className="card overflow-hidden" aria-label={t('tmMembersLbl')}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <p className="font-display text-base font-extrabold tracking-tight">
          {t('tmMembersLbl')} <span className="text-faint">· {members.length}</span>
        </p>
        {canManage ? (
          <button
            type="button"
            onClick={() => setInviteOpen((v) => !v)}
            aria-expanded={inviteOpen}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition ${
              inviteOpen ? 'bg-surface text-ink' : 'bg-ink text-bone hover:opacity-90'
            }`}
          >
            {inviteOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            {inviteOpen ? t('tmCancel') : t('tmInviteTeammate')}
          </button>
        ) : null}
      </div>
      {invitePanel}
      <ul className="divide-y divide-line-soft">
        {members.map((m) => {
          const self = m.user_id === myUserId;
          const open = assigning === m.id;
          return (
            <li key={m.id} className={`px-5 py-4 transition ${open ? 'bg-surface/50' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
                  <MemberAvatar path={m.user_id ? memberAvatars[m.user_id] : undefined} email={m.email} />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-bold">{m.email}</span>
                      {self ? (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10px] font-extrabold text-on-accent">
                          {t('tmYou').replace(/[()]/g, '')}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          m.role === 'owner'
                            ? 'bg-ink text-bone'
                            : m.role === 'admin'
                              ? 'bg-accent-soft text-ink'
                              : 'bg-surface text-soft'
                        }`}
                      >
                        <RoleIcon r={m.role} />
                        {roleLabel(m.role)}
                      </span>
                      <span className="truncate rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                        {summary(m)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-1.5">
                  {canChangeRole(m) ? (
                    <SegmentedPills
                      ariaLabel={fill(t('tmRoleFor'), { email: m.email })}
                      size="sm"
                      value={m.role as 'member' | 'admin'}
                      onChange={(r) => void saveRole(m, r)}
                      options={[
                        { value: 'member', label: t('roleMember'), disabled: busy },
                        { value: 'admin', label: t('roleAdmin'), disabled: busy },
                      ]}
                    />
                  ) : null}
                  {canAssign(m) ? (
                    <button
                      type="button"
                      onClick={() => openAssign(m)}
                      aria-expanded={open}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        open ? 'border-ink bg-ink text-bone' : 'border-line text-soft hover:bg-surface'
                      }`}
                    >
                      <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                      {open ? t('tmDone') : t('tmManageChannels')}
                    </button>
                  ) : null}
                  {self && myRole !== 'owner' ? (
                    <button
                      type="button"
                      onClick={() => void leave()}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-soft hover:bg-surface disabled:opacity-50"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('tmLeaveTeam')}
                    </button>
                  ) : null}
                  {canRemove(m) ? (
                    confirmRemove === m.id ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FDEBEC] p-0.5 dark:bg-[#2c1b1b]">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => remove(m)}
                          className="rounded-full bg-[#E5484D] px-3 py-1 text-xs font-bold text-white"
                        >
                          {t('tmConfirm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(null)}
                          className="rounded-full px-3 py-1 text-xs font-bold text-[#9F2F2D] dark:text-[#f2a8a8]"
                        >
                          {t('tmKeep')}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(m.id)}
                        aria-label={`${t('tmRemove')} ${m.email}`}
                        title={t('tmRemove')}
                        className="grid h-8 w-8 place-items-center rounded-full text-faint transition hover:bg-[#FDEBEC] hover:text-[#9F2F2D] dark:hover:bg-[#2c1b1b] dark:hover:text-[#f2a8a8]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )
                  ) : null}
                </div>
              </div>

              {open ? (
                <div className="mt-3 rounded-2xl border border-line bg-card p-4">
                  <p className="text-xs font-bold">{fill(t('tmAccountsPost'), { email: m.email })}</p>
                  <div className="mt-3">
                    <ChannelScopePills
                      channels={channels}
                      all={gAll}
                      selected={gSel}
                      onChange={(all, sel) => {
                        setGAll(all);
                        setGSel(sel);
                      }}
                    />
                  </div>
                  {channels.length === 0 ? <p className="mt-2 text-xs text-muted">{t('tmNoChannelsYet')}</p> : null}
                  <button type="button" disabled={busy} onClick={() => saveGrants(m)} className="btn btn-primary mt-3">
                    {busy ? t('tmSaving') : t('tmSaveAccounts')}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pending}
      {!canManage ? <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-muted">{t('tmMemberOnly')}</p> : null}
    </section>
  );

  // One full-width flow: team strip, then the members card (invite panel and
  // pending invites live inside it), so no column is left half empty.
  return (
    <div className="space-y-4">
      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}
      {identity}
      {roster}
    </div>
  );
}
