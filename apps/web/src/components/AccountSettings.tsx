'use client';

/**
 * Account settings — web port of the mobile Account screen: identity header,
 * cloud session, notification/email/password rows, connect + plan + team,
 * report inbox, changelog, legal. Writes go to the real backend (profiles,
 * workspaces, auth, reports), so the phone picks them up on next sync.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CloudUpload,
  CreditCard,
  FileText,
  Flag,
  KeyRound,
  Mail,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

type View = 'main' | 'notif' | 'email' | 'password' | 'plan' | 'report' | 'changelog' | 'legal';
type ReportKind = 'bug' | 'idea' | 'billing' | 'other';

const CHANGELOG = [
  {
    v: '1.0.0',
    notes: [
      'Post hub: composer, templates, publish queue and ideas',
      'Web account connect for every network, same vault as mobile',
      'AI captions, studio copy and picture search',
      'Calendar month, week and day time management',
      'Per-channel analytics with delivery tracking',
    ],
  },
];

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`}
      />
    </button>
  );
}

function Row({
  icon,
  label,
  sub,
  href,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <>
      <span className={`shrink-0 ${danger ? 'text-[#9F2F2D]' : 'text-ink'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${danger ? 'text-[#9F2F2D]' : ''}`}>{label}</span>
        {sub ? <span className="block truncate text-xs text-muted">{sub}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
    </>
  );
  const cls =
    'flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-bone dark:hover:bg-white/5';
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export default function AccountSettings({
  email,
  workspaceId,
  workspaceName,
  role,
  canRename,
  userId,
  initialNotif,
}: {
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  canRename: boolean;
  userId: string;
  initialNotif: { posts: boolean; comments: boolean; weekly: boolean };
}) {
  const router = useRouter();
  const [view, setView] = useState<View>('main');
  const [notif, setNotif] = useState(initialNotif);
  const [notifSaved, setNotifSaved] = useState(false);
  const [draftName, setDraftName] = useState(workspaceName);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [repKind, setRepKind] = useState<ReportKind>('bug');
  const [repSubject, setRepSubject] = useState('');
  const [repBody, setRepBody] = useState('');
  const [repBusy, setRepBusy] = useState(false);
  const [cloudInfo, setCloudInfo] = useState(false);

  const initial = (email || workspaceName || 'S')[0].toUpperCase();
  const title =
    view === 'main' ? 'Account' : view === 'notif' ? 'Notifications' : view === 'email' ? 'Email settings'
    : view === 'password' ? 'Change password' : view === 'plan' ? 'Subscription'
    : view === 'changelog' ? "What's new" : view === 'report' ? 'Report a problem' : 'Legal';

  async function flipNotif(key: 'posts' | 'comments' | 'weekly') {
    const col = key === 'posts' ? 'notif_posts' : key === 'comments' ? 'notif_comments' : 'notif_weekly';
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    setNotifSaved(false);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.from('profiles').update({ [col]: next[key] }).eq('id', userId);
      if (error) throw new Error(error.message);
      setNotifSaved(true);
    } catch (e) {
      setNotif(initialNotif);
      setErr(e instanceof Error ? e.message : 'Could not save that preference.');
    }
  }

  async function saveName() {
    const name = draftName.trim() || 'My team';
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const sb = createClient();
      const { error } = await sb.from('workspaces').update({ name }).eq('id', workspaceId);
      if (error) throw new Error(error.message);
      setNote('Workspace name saved — the phone picks it up on next sync.');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the name.');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    setErr(null);
    setNote(null);
    if (pw1.length < 6) {
      setErr('Use at least 6 characters.');
      return;
    }
    if (pw1 !== pw2) {
      setErr('The two passwords differ.');
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const { error } = await sb.auth.updateUser({ password: pw1 });
      if (error) throw new Error(error.message);
      setPw1('');
      setPw2('');
      setNote('Password updated.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReport() {
    setErr(null);
    if (!repBody.trim()) {
      setErr('Describe the problem first.');
      return;
    }
    setRepBusy(true);
    try {
      const sb = createClient();
      const { error } = await sb.from('reports').insert({
        workspace_id: workspaceId,
        user_id: userId,
        email,
        kind: repKind,
        subject: repSubject.trim(),
        body: repBody.trim(),
      });
      if (error) throw new Error(error.message);
      setRepKind('bug');
      setRepSubject('');
      setRepBody('');
      setView('main');
      setNote('Report sent — it’s in the owner inbox.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the report.');
    } finally {
      setRepBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
      <button
        type="button"
        onClick={() => (view === 'main' ? router.push('/dashboard') : setView('main'))}
        aria-label={view === 'main' ? 'Back to dashboard' : 'Back to account'}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:bg-paper"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>

      {note ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          {note}
        </p>
      ) : null}
      {err ? (
        <p className="mt-3 rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}

      {view === 'main' ? (
        <>
          <Card className="mt-4 flex items-center gap-4 p-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl font-extrabold text-paper">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">{email || 'No email set'}</span>
              <span className="block truncate text-xs text-muted">{workspaceName}</span>
            </span>
            <span className="shrink-0 rounded-full bg-paper-dim px-2.5 py-1 text-[11px] font-bold text-ink">
              {role}
            </span>
          </Card>

          <Card className="mt-3 p-5">
            <p className="text-xs font-bold text-soft">Signed in</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {email} · {workspaceName} ({role})
            </p>
            <form action="/auth/signout" method="post" className="mt-3">
              <Button variant="ghost" className="w-full" type="submit">
                Sign out
              </Button>
            </form>
          </Card>

          <Card className="mt-3 divide-y divide-line-soft overflow-hidden">
            <Row icon={<Bell className="h-5 w-5" aria-hidden="true" />} label="Notification settings" sub="Post reminders, comments, digest" onClick={() => setView('notif')} />
            <Row icon={<Mail className="h-5 w-5" aria-hidden="true" />} label="Email settings" sub={email || 'Set your email'} onClick={() => { setDraftName(workspaceName); setView('email'); }} />
            <Row icon={<KeyRound className="h-5 w-5" aria-hidden="true" />} label="Change password" onClick={() => { setPw1(''); setPw2(''); setView('password'); }} />
          </Card>

          <Card className="mt-3 divide-y divide-line-soft overflow-hidden">
            <Row icon={<CirclePlus className="h-5 w-5" aria-hidden="true" />} label="Connect new channel" sub="Pick a network to link" href="/channels" />
            <Row
              icon={<CloudUpload className="h-5 w-5" aria-hidden="true" />}
              label="Cloud publishing"
              sub="Always on — tokens stay encrypted in the vault"
              onClick={() => setCloudInfo((v) => !v)}
            />
            {cloudInfo ? (
              <p className="px-5 py-3 text-xs leading-relaxed text-muted">
                Connecting a channel stores an encrypted copy of its tokens so scheduled posts publish
                while you are away. To revoke a channel, disconnect it in Channels.
              </p>
            ) : null}
            <Row icon={<CreditCard className="h-5 w-5" aria-hidden="true" />} label="Subscription plan" sub="Free, Starter, Pro and Business" onClick={() => setView('plan')} />
            {role === 'owner' || role === 'admin' ? (
              <Row icon={<Users className="h-5 w-5" aria-hidden="true" />} label="Team" sub="Roles, channels & invites" href="/team" />
            ) : null}
            <Row icon={<Star className="h-5 w-5" aria-hidden="true" />} label="Rate Sosial" sub="Tell us how we are doing" onClick={() => setView('report')} />
            <Row icon={<Flag className="h-5 w-5" aria-hidden="true" />} label="Report a problem" sub="Bugs, ideas, billing help" onClick={() => { setRepKind('bug'); setRepSubject(''); setRepBody(''); setView('report'); }} />
            <Row icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label="What's new" sub="Changelog" onClick={() => setView('changelog')} />
          </Card>

          <Card className="mt-3 divide-y divide-line-soft overflow-hidden">
            <Row icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} label="Privacy policy" href="/privacy" />
            <Row icon={<FileText className="h-5 w-5" aria-hidden="true" />} label="Terms of use" href="/terms" />
            <Row icon={<Scale className="h-5 w-5" aria-hidden="true" />} label="Legal" onClick={() => setView('legal')} />
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Appearance</span>
                <span className="block text-xs text-muted">Light or dark dashboard</span>
              </span>
              <ThemeToggle />
            </div>
          </Card>
        </>
      ) : null}

      {view === 'notif' ? (
        <Card className="mt-4 divide-y divide-line-soft overflow-hidden">
          {([
            { key: 'posts', label: 'Post reminders', sub: 'Alert when a queued post is due' },
            { key: 'comments', label: 'Comments & mentions', sub: 'Alert on new comments' },
            { key: 'weekly', label: 'Weekly digest', sub: 'A Monday summary of your channels' },
          ] as const).map((r) => (
            <div key={r.key} className="flex items-center gap-3 px-5 py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{r.label}</span>
                <span className="block text-xs text-muted">{r.sub}</span>
              </span>
              <Switch on={notif[r.key]} onToggle={() => void flipNotif(r.key)} label={r.label} />
            </div>
          ))}
          <p className="px-5 py-3 text-xs leading-relaxed text-muted">
            Saved to your profile{notifSaved ? ' ✓' : ''} — the phone picks these up on next sync. Reminder
            alerts need the installed app with notifications allowed.
          </p>
        </Card>
      ) : null}

      {view === 'email' ? (
        <Card className="mt-4 space-y-3 p-5">
          <div>
            <p className="text-xs font-bold text-muted">Email</p>
            <p className="mt-1 text-sm font-bold">{email || 'No email set'}</p>
            <p className="mt-0.5 text-[11px] text-faint">Managed by sign-in — contact support to change it.</p>
          </div>
          <div>
            <p className="text-xs font-bold text-muted">Team / organization</p>
            {canRename ? (
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="My team"
                aria-label="Workspace name"
                className="field mt-1"
              />
            ) : (
              <p className="mt-1 text-sm font-bold">{workspaceName}</p>
            )}
            {!canRename ? (
              <p className="mt-0.5 text-[11px] text-faint">Only owners and admins can rename the workspace.</p>
            ) : null}
          </div>
          {canRename ? (
            <Button onClick={() => void saveName()} disabled={busy} className="w-full">
              {busy ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
        </Card>
      ) : null}

      {view === 'password' ? (
        <Card className="mt-4 space-y-3 p-5">
          <div>
            <p className="text-xs font-bold text-muted">New password</p>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-label="New password"
              className="field mt-1"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-muted">Confirm</p>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-label="Confirm password"
              className="field mt-1"
            />
          </div>
          <Button onClick={() => void savePassword()} disabled={busy} className="w-full">
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </Card>
      ) : null}

      {view === 'plan' ? (
        <div className="mt-4 space-y-3">
          {[
            {
              name: 'Free',
              price: 'Free',
              features: ['3 connected channels · 30 scheduled posts a month', 'Unlimited studio, templates & ideas', '7-day analytics'],
            },
            {
              name: 'Starter',
              price: '$12/mo',
              sub: '$120/yr annual — ≈ $10/month, billed yearly',
              also: 'Everything in Free, plus:',
              features: ['Unlimited scheduled posts', '500 AI generations / month', 'All 10 channels connected', '1-year analytics'],
            },
            {
              name: 'Pro',
              price: '$29/mo',
              sub: '$290/yr annual — ≈ $24.17/month, billed yearly',
              also: 'Everything in Starter, plus:',
              features: ['Approval workflow', '1,000 AI generations / month', 'Member, admin and owner roles', 'Priority support'],
            },
            {
              name: 'Business',
              price: '$79/mo',
              sub: '$790/yr annual — ≈ $65.83/month, billed yearly',
              also: 'Everything in Pro, plus:',
              features: ['2,000 AI generations / month', 'Unlimited seats for the whole crew', 'Per-channel member roles', 'Premium support'],
            },
          ].map((p) => (
            <Card key={p.name} className="p-5">
              <p className="font-display text-base font-extrabold tracking-tight">{p.name}</p>
              <p className="mt-0.5 font-display text-xl font-extrabold">{p.price}</p>
              {p.sub ? <p className="text-xs text-muted">{p.sub}</p> : null}
              {p.also ? <p className="mt-2 text-xs text-muted">{p.also}</p> : null}
              <ul className="mt-2 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-soft">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f8f5b]" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <Link href="/billing" className="btn btn-bolt w-full">
            Manage billing
          </Link>
          <Link href="/pricing" className="btn btn-ghost w-full">
            See full pricing
          </Link>
        </div>
      ) : null}

      {view === 'report' ? (
        <Card className="mt-4 space-y-3 p-5">
          <p className="text-xs leading-relaxed text-muted">
            Bugs, ideas, billing help — goes straight to the owner inbox. Sends from your cloud account.
          </p>
          <div className="flex gap-1.5" role="group" aria-label="Report kind">
            {(['bug', 'idea', 'billing', 'other'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setRepKind(k)}
                aria-pressed={repKind === k}
                className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-bold capitalize transition ${
                  repKind === k ? 'bg-ink text-paper' : 'bg-paper-dim text-muted hover:text-ink'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <input
            value={repSubject}
            onChange={(e) => setRepSubject(e.target.value)}
            placeholder="Short summary (optional)"
            aria-label="Subject"
            className="field !text-xs"
          />
          <textarea
            value={repBody}
            onChange={(e) => setRepBody(e.target.value)}
            placeholder="What happened? What did you expect?"
            rows={5}
            aria-label="Details"
            className="field min-h-[120px] resize-y !text-xs"
          />
          <Button onClick={() => void sendReport()} disabled={repBusy} className="w-full">
            <Send className="h-4 w-4" aria-hidden="true" />
            {repBusy ? 'Sending…' : 'Send report'}
          </Button>
        </Card>
      ) : null}

      {view === 'changelog' ? (
        <div className="mt-4 space-y-3">
          {CHANGELOG.map((c) => (
            <Card key={c.v} className="p-5">
              <p className="font-display text-base font-extrabold">v{c.v}</p>
              <ul className="mt-2 space-y-1.5">
                {c.notes.map((n) => (
                  <li key={n} className="text-xs leading-relaxed text-muted">
                    • {n}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}

      {view === 'legal' ? (
        <Card className="mt-4 p-5">
          <p className="text-sm leading-relaxed text-soft">
            © 2026 Sosial. All rights reserved.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-soft">
            Facebook, Instagram and Threads are trademarks of Meta Platforms, Inc. This app is not
            affiliated with or endorsed by Meta.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-soft">
            Open-source licenses for bundled libraries are available in the project repository.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
