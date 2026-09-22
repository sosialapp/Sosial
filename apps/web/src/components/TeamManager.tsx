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

/** Roster + invites, following the mobile permission model: owners manage
 *  everyone (never another owner), admins manage members only. */
export default function TeamManager({
  workspaceId,
  myUserId,
  myRole,
  members,
  invites,
}: {
  workspaceId: string;
  myUserId: string;
  myRole: 'owner' | 'admin' | 'member';
  members: TeamMemberRow[];
  invites: TeamInviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [allChannels, setAllChannels] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const canManage = myRole === 'owner' || myRole === 'admin';
  const canRemove = (m: TeamMemberRow): boolean => {
    if (m.user_id === myUserId) return false;
    if (myRole === 'owner') return m.role !== 'owner';
    if (myRole === 'admin') return m.role === 'member';
    return false;
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
            <div key={m.id} className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-white">
                {(m.email[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {m.email}
                  {self ? <span className="ml-2 text-xs font-medium text-muted">(you)</span> : null}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-1.5">
                  <span className="pill bg-accent-soft text-accent-ink">{m.role}</span>
                  <span className="pill bg-surface text-soft">
                    {m.all_channels ? 'All channels' : 'Selected channels'}
                  </span>
                </p>
              </div>
              {canRemove(m) ? (
                confirmRemove === m.id ? (
                  <span className="flex shrink-0 gap-1.5">
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
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(m.id)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-[#9F2F2D] hover:bg-[#FDEBEC] dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]"
                  >
                    Remove
                  </button>
                )
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
          Only owners and admins can invite — ask one to add your teammates.
        </p>
      )}
    </div>
  );
}
