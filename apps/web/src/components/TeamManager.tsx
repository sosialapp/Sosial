'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

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

/** Roster + invites, following the mobile permission model: owners manage
 *  everyone (never another owner), admins manage members only. Owners appoint
 *  which connected accounts each teammate may post to; only the owner can
 *  disconnect an account (that lives on the Channels page). */
export default function TeamManager({
  workspaceId,
  myUserId,
  myRole,
  members,
  invites,
  grants,
  channels,
}: {
  workspaceId: string;
  myUserId: string;
  myRole: 'owner' | 'admin' | 'member';
  members: TeamMemberRow[];
  invites: TeamInviteRow[];
  grants: { member_id: string; provider: string }[];
  channels: TeamChannelRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [allChannels, setAllChannels] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<string | null>(null);
  const [gAll, setGAll] = useState(true);
  const [gSel, setGSel] = useState<string[]>([]);

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
  const providersOf = (m: TeamMemberRow): string[] =>
    grants.filter((g) => g.member_id === m.id).map((g) => g.provider);
  const summary = (m: TeamMemberRow): string => {
    if (m.all_channels) return 'All channels';
    const ps = providersOf(m);
    if (ps.length === 0) return 'No accounts yet';
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
      setErr(e2 instanceof Error ? e2.message : 'Could not save appointments.');
    } finally {
      setBusy(false);
    }
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErr('Add the teammate’s email so the invite reaches them.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('create_invite', {
        p_workspace_id: workspaceId,
        p_email: email.trim(),
        p_role: role,
        p_all_channels: allChannels,
      });
      if (error) throw new Error(error.message);
      setEmail('');
      setRole('member');
      setAllChannels(true);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not send the invite.');
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
      setErr(e2 instanceof Error ? e2.message : 'Could not remove this teammate.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="card divide-y divide-line-soft" aria-label="Members">
        {members.map((m) => {
          const self = m.user_id === myUserId;
          return (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#191512] font-display text-sm font-extrabold text-white">
                  {(m.email[0] ?? '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {m.email}
                    {self ? <span className="ml-2 text-xs font-medium text-muted">(you)</span> : null}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="pill bg-accent-soft text-accent-ink">{m.role}</span>
                    <span className="pill bg-surface text-soft">{summary(m)}</span>
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5">
                  {canAssign(m) ? (
                    <button
                      type="button"
                      onClick={() => openAssign(m)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-soft hover:bg-surface"
                    >
                      {assigning === m.id ? 'Done' : 'Manage channels'}
                    </button>
                  ) : null}
                  {canRemove(m) ? (
                    confirmRemove === m.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => remove(m)}
                          className="rounded-full bg-[#E60023] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(null)}
                          className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-soft"
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(m.id)}
                        className="rounded-full px-3 py-1.5 text-xs font-bold text-[#9F2F2D] hover:bg-[#FDEBEC] dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]"
                      >
                        Remove
                      </button>
                    )
                  ) : null}
                </span>
              </div>

              {assigning === m.id ? (
                <div className="mt-3 rounded-2xl border border-line bg-surface/60 p-4">
                  <p className="text-xs font-bold">
                    Accounts {m.email} can post to
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGAll(true);
                        setGSel([]);
                      }}
                      className={`pill border ${gAll ? 'border-ink bg-[#191512] text-white' : 'border-line bg-card text-soft'}`}
                    >
                      All accounts
                    </button>
                    {channels.map((c) => {
                      const on = !gAll && gSel.includes(c.provider);
                      return (
                        <button
                          key={`${c.provider}:${c.external_id}`}
                          type="button"
                          onClick={() => {
                            setGAll(false);
                            setGSel((prev) =>
                              prev.includes(c.provider)
                                ? prev.filter((p) => p !== c.provider)
                                : [...prev, c.provider],
                            );
                          }}
                          className={`pill border ${on ? 'border-ink bg-[#191512] text-white' : 'border-line bg-card text-soft'}`}
                        >
                          {channelLabel(c)}
                        </button>
                      );
                    })}
                  </div>
                  {channels.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      Connect an account first — there are no channels to appoint yet.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveGrants(m)}
                    className="btn btn-primary mt-3"
                  >
                    {busy ? 'Saving…' : 'Save accounts'}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {invites.length > 0 ? (
        <section className="card p-5" aria-label="Pending invites">
          <p className="eyebrow">Pending invites</p>
          <ul className="mt-3 space-y-2">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold">{inv.email}</span>
                <span className="pill shrink-0 bg-surface text-soft">{inv.role}</span>
                {inv.expires_at ? (
                  <span className="shrink-0 text-xs text-muted">
                    expires {new Date(inv.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? (
        <section className="card p-5" aria-label="Invite teammate">
          <p className="eyebrow">Invite teammate</p>
          <form onSubmit={invite} className="mt-3 space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@studio.com"
              type="email"
              autoCapitalize="none"
              className="field"
              aria-label="Teammate email"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-muted" htmlFor="team-role">
                Role
              </label>
              <select
                id="team-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                className="field w-auto"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted">
                <input
                  type="checkbox"
                  checked={allChannels}
                  onChange={(e) => setAllChannels(e.target.checked)}
                  className="h-4 w-4 accent-[#c8500f]"
                />
                All channels
              </label>
            </div>
            {err ? <p className="text-sm font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{err}</p> : null}
            <button type="submit" disabled={busy} className="btn btn-primary w-full sm:w-auto">
              {busy ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </section>
      ) : (
        <p className="card p-5 text-sm text-muted">
                      Only owners and admins can invite. Ask one to add your teammates.
        </p>
      )}
    </div>
  );
}
