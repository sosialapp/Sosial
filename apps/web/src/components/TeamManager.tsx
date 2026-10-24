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
    <section className="card overflow-hidden" aria-label={t('tmTeamNameAria')}>
      <div className="h-16 bg-gradient-to-br from-accent/60 via-accent-soft to-transparent" aria-hidden="true" />
      <div className="-mt-9 px-5 pb-5">
        <div className="flex items-end gap-3">
          <span className="relative shrink-0">
            {teamAvatarUrl && !teamAvatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={teamAvatarUrl}
                alt={t('tmTeamPicture')}
                onError={() => setTeamAvatarFailed(true)}
                className="h-[72px] w-[72px] rounded-[22px] border-4 border-card object-cover"
              />
            ) : (
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border-4 border-card bg-ink font-display text-2xl font-extrabold text-bone">
                {(draftName.trim() || workspaceName || 'T')[0].toUpperCase()}
              </span>
            )}
            {avatarBusy ? (
              <span className="absolute inset-1 flex items-center justify-center rounded-[18px] bg-black/40" aria-hidden="true">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              </span>
            ) : null}
            {canManage ? (
              <label
                className="absolute -right-1 -bottom-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 border-card bg-ink text-bone transition hover:scale-105"
                title={teamAvatarUrl ? t('tmChange') : t('tmAddPhoto')}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
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
          {canManage && teamAvatarUrl ? (
            <button
              type="button"
              onClick={() => void removeTeamAvatar()}
              className="mb-1 rounded-full px-2 py-1 text-[11px] font-bold text-muted transition hover:text-[#9F2F2D]"
            >
              {t('tmRemove')}
            </button>
          ) : null}
        </div>

        {editingName ? (
          <div className="mt-3 flex flex-col gap-2">
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
              className="field min-w-0"
            />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void saveName()} className="btn btn-primary flex-1">
                {busy ? t('tmSaving') : t('tmSave')}
              </button>
              <button type="button" disabled={busy} onClick={cancelNameEdit} className="btn flex-1">
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
            className="group mt-3 flex max-w-full items-center gap-2 rounded-lg text-left"
          >
            <span className="truncate font-display text-2xl font-extrabold tracking-tight">{workspaceName}</span>
            <Pencil className="h-4 w-4 shrink-0 text-faint transition group-hover:text-ink" aria-hidden="true" />
          </button>
        ) : (
          <p className="mt-3 truncate font-display text-2xl font-extrabold tracking-tight">{workspaceName}</p>
        )}

        {avatarMsg ? <p className="mt-2 text-xs font-bold text-[#346538] dark:text-[#8fd0a0]">{avatarMsg}</p> : null}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {(
            [
              [members.length, t('tmMembersLbl')],
              [leads, t('tmLeadsLbl')],
              [invites.length, t('tmPendingShort')],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="rounded-2xl bg-surface px-2 py-2.5">
              <dd className="font-display text-xl font-extrabold tabular-nums leading-none">{n}</dd>
              <dt className="mt-1 truncate text-[11px] font-bold text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );

  /* -------------------------------- invite -------------------------------- */

  const inviteCard = canManage ? (
    <section className="card p-5" aria-label={t('tmInviteTeammate')}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-on-accent">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="font-display text-base font-extrabold tracking-tight">{t('tmInviteTeammate')}</p>
      </div>
      <form onSubmit={invite} className="mt-4 space-y-4">
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('tmEmailPh')}
            type="email"
            autoCapitalize="none"
            className="field !pl-10"
            aria-label={t('tmEmailAria')}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold text-muted">{t('tmRole')}</p>
          <SegmentedPills
            ariaLabel={t('tmRole')}
            value={role}
            onChange={setRole}
            buttonClassName="flex-1"
            options={[
              { value: 'member', label: t('roleMember') },
              { value: 'admin', label: t('roleAdmin') },
            ]}
          />
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
          <div className="rounded-2xl bg-surface p-3 text-sm">
            <p className="font-bold">{t('tmAlreadyOnSosial')}</p>
            <p className="mt-1 break-all text-xs text-muted">{inviteLink}</p>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(inviteLink)}
              className="btn btn-ghost mt-2"
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {t('tmCopyLink')}
            </button>
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="btn btn-primary w-full justify-center">
          {busy ? t('tmSending') : t('tmSendInvite')}
        </button>
      </form>
    </section>
  ) : (
    <p className="card p-5 text-sm leading-relaxed text-muted">{t('tmMemberOnly')}</p>
  );

  /* ------------------------------- pending -------------------------------- */

  const pending =
    invites.length > 0 ? (
      <section className="card p-5" aria-label={t('tmPendingInvites')}>
        <p className="font-display text-base font-extrabold tracking-tight">
          {t('tmPendingInvites')} <span className="text-faint">· {invites.length}</span>
        </p>
        <ul className="mt-3 space-y-2">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-faint">
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
      </section>
    ) : null;

  /* ------------------------------- members -------------------------------- */

  const roster = (
    <section className="card overflow-hidden" aria-label={t('tmMembersLbl')}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <p className="font-display text-base font-extrabold tracking-tight">
          {t('tmMembersLbl')} <span className="text-faint">· {members.length}</span>
        </p>
      </div>
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
    </section>
  );

  // Desktop: roster on the left, team card / invite / pending on the right.
  // Phone: team card, then the roster, then invite and pending.
  return (
    <div className="space-y-4">
      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 lg:order-2">
          {identity}
          <div className="hidden space-y-4 lg:block">
            {inviteCard}
            {pending}
          </div>
        </div>
        <div className="min-w-0 space-y-4 lg:order-1">
          {roster}
          <div className="space-y-4 lg:hidden">
            {inviteCard}
            {pending}
          </div>
        </div>
      </div>
    </div>
  );
}
