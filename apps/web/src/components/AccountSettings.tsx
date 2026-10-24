'use client';

/**
 * Account settings, web port of the mobile Account screen: identity header,
 * cloud session, notification/email/password rows, connect + plan + team,
 * report inbox, changelog, legal. Writes go to the real backend (profiles,
 * workspaces, auth, reports), so the phone picks them up on next sync.
 */
import { useEffect, useState } from 'react';
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
  Image as ImageIcon,
  KeyRound,
  Languages,
  Mail,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';
import { createClient } from '@/lib/supabase/client';
import { LOCALE_COOKIE, LOCALE_COOKIE_ATTRS, LOCALE_META } from '@/lib/i18n/locales';
import { useSignedUrl } from '@/lib/useSignedUrl';
import { PLAN_ORDER, PLANS, monthlyEquivalent, priceLabel } from '@/lib/billing/plans';
import SegmentedPills from '@/components/ui/segmented-pills';

type View = 'main' | 'notif' | 'email' | 'password' | 'plan' | 'report' | 'changelog' | 'legal' | 'delete' | 'ticket';
type ReportKind = 'bug' | 'idea' | 'billing' | 'other';

interface UserReport {
  id: string;
  kind: string;
  subject: string;
  body: string;
  status: string;
  admin_note: string;
  attachments: string[];
  created_at: string;
  updated_at: string;
}

const MAX_ATTACHMENTS = 3;
const MAX_FILE_MB = 10;
const TICKET_STATUSES: Record<string, { label: string; tone: string }> = {
  open: { label: 'stTicketOpen', tone: 'bg-[#FFF4DC] text-[#8a6116] dark:bg-[#332a15] dark:text-[#e8c877]' },
  triaged: { label: 'stTicketTriaged', tone: 'bg-[#E8F0FB] text-[#2d5a9e] dark:bg-[#182338] dark:text-[#8db4ec]' },
  resolved: { label: 'stTicketResolved', tone: 'bg-[#EDF3EC] text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]' },
  closed: { label: 'stTicketClosed', tone: 'bg-paper-dim text-muted' },
};

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

function TicketImage({ path, userId }: { path: string; userId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const sb = createClient();
        const { data, error } = await sb.storage.from('report-media').createSignedUrl(path, 3600);
        if (!alive) return;
        if (error || !data?.signedUrl) throw new Error(error?.message ?? 'no url');
        setUrl(data.signedUrl);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [path, userId]);
  if (failed) {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-line bg-paper-dim text-[10px] font-bold text-faint">
        Unavailable
      </span>
    );
  }
  if (!url) {
    return <span className="h-20 w-20 animate-pulse rounded-xl bg-paper-dim" aria-hidden="true" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Ticket attachment" className="h-20 w-20 rounded-xl border border-line object-cover" />
    </a>
  );
}

export default function AccountSettings({
  email,
  workspaceId,
  workspaceName,
  planLabel,
  role,
  canRename,
  userId,
  initialNotif,
  initialLocale,
  locales,
}: {
  email: string;
  workspaceId: string;
  workspaceName: string;
  planLabel: string;
  role: string;
  canRename: boolean;
  userId: string;
  initialNotif: { posts: boolean; comments: boolean; weekly: boolean; marketing: boolean };
  initialLocale: string;
  locales: readonly string[];
}) {
  const router = useRouter();
  const t = useT(appMessages);
  const [view, setView] = useState<View>('main');
  const [notif, setNotif] = useState(initialNotif);
  const [locale, setLocale] = useState(initialLocale);
  const [langSaved, setLangSaved] = useState(false);
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
  const [repFiles, setRepFiles] = useState<File[]>([]);
  const [myTickets, setMyTickets] = useState<UserReport[] | null>(null);
  const [cloudInfo, setCloudInfo] = useState(false);
  const [delArmed, setDelArmed] = useState(false);
  const [delWord, setDelWord] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  /** Signed URL for the stored avatar (retried, so it shows on arrival). */
  const avatarUrl = useSignedUrl(avatarPath, 'avatars', 3600);
  useEffect(() => setAvatarFailed(false), [avatarUrl]);

  /** Load the stored avatar path (retried: the edge call can race the session). */
  useEffect(() => {
    let dead = false;
    (async () => {
      const sb = createClient();
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const { data, error } = await sb.functions.invoke('profile-avatar', { method: 'GET' });
          if (!error) {
            const p = (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
            if (!dead) setAvatarPath(p);
            return;
          }
        } catch { /* session not ready yet, retry */ }
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    })();
    return () => { dead = true; };
  }, []);

  /** Upload → compress server-side → refresh. */
  async function changeAvatar(file: File) {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setErr(null);
    try {
      const b64 = await fileToAvatarDataUrl(file);
      if (!b64) throw new Error(t('asErrImgFormat'));
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('profile-avatar', {
        body: { image_base64: b64 },
      });
      if (error) throw new Error(error.message);
      const msg = (data as { error?: string } | null)?.error;
      if (msg) throw new Error(msg);
      setAvatarPath((data as { avatar_url?: string }).avatar_url ?? null);
      setNote(t('asNoteAvatarSaved'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('asErrAvatar'));
    } finally {
      setAvatarBusy(false);
    }
  }

  /** Pull the Google account picture (one click for Google users). */
  async function useGooglePicture() {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('profile-avatar', {
        body: { source: 'google' },
      });
      if (error) throw new Error(error.message);
      const msg = (data as { error?: string } | null)?.error;
      if (msg) throw new Error(msg);
      setAvatarPath((data as { avatar_url?: string }).avatar_url ?? null);
      setNote(t('asNoteGooglePfp'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('asErrNoGoogle'));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setErr(null);
    try {
      const sb = createClient();
      const { error } = await sb.functions.invoke('profile-avatar', { method: 'DELETE' });
      if (error) throw new Error(error.message);
      setAvatarPath(null);
      setNote(t('asNoteAvatarRemoved'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('asErrAvatarRemove'));
    } finally {
      setAvatarBusy(false);
    }
  }

  const initial = (email || workspaceName || 'S')[0].toUpperCase();
  const title =
    view === 'main' ? t('asTitleAccount') : view === 'notif' ? t('asTitleNotif') : view === 'email' ? t('asTitleEmail')
    : view === 'password' ? t('asTitlePassword') : view === 'plan' ? t('asTitlePlan')
    : view === 'changelog' ? t('asTitleNew') : view === 'report' || view === 'ticket' ? t('asTitleSupport')
    : view === 'delete' ? t('asTitleDelete') : t('asTitleLegal');

  async function flipNotif(key: 'posts' | 'comments' | 'weekly' | 'marketing') {
    const col = key === 'posts' ? 'notif_posts' : key === 'comments' ? 'notif_comments' : key === 'marketing' ? 'notif_marketing' : 'notif_weekly';
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

  /** Language: cookie drives the site immediately, profiles.locale syncs the app. */
  async function changeLang(next: string) {
    setLocale(next);
    setLangSaved(false);
    document.cookie = `${LOCALE_COOKIE}=${next}; ${LOCALE_COOKIE_ATTRS}`;
    try {
      const sb = createClient();
      const { error } = await sb.from('profiles').update({ locale: next }).eq('id', userId);
      if (error) throw new Error(error.message);
      setLangSaved(true);
    } finally {
      router.refresh();
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
      setNote(t('asNoteWsSaved'));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('asErrWsSave'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteMyData() {
    if (delWord.trim().toLowerCase() !== 'confirm') {
      setErr(t('asErrConfirmWord'));
      return;
    }
    setDelBusy(true);
    setErr(null);
    setNote(null);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('delete-account', {
        body: { confirmation: 'confirm' },
      });
      if (error) throw new Error(error.message);
      const msg = (data as { error?: string } | null)?.error;
      if (msg) throw new Error(msg);
      // Server data is gone, drop this browser's cloud tokens, then sign out.
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k?.startsWith('sosial_cloud_')) localStorage.removeItem(k);
        }
      } catch {}
      await fetch('/auth/signout', { method: 'POST' });
      router.replace('/');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete your data.');
    } finally {
      setDelBusy(false);
    }
  }

  async function savePassword() {
    setErr(null);
    setNote(null);
    if (pw1.length < 6) {
      setErr(t('asErrPwShort'));
      return;
    }
    if (pw1 !== pw2) {
      setErr(t('asErrPwDiffer'));
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const { error } = await sb.auth.updateUser({ password: pw1 });
      if (error) throw new Error(error.message);
      setPw1('');
      setPw2('');
      setNote(t('asNotePwSaved'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('asErrPwSave'));
    } finally {
      setBusy(false);
    }
  }

  const openTicket = myTickets?.find((t) => t.status === 'open' || t.status === 'triaged') ?? null;

  async function loadTickets() {
    setMyTickets(null);
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from('reports')
        .select('id, kind, subject, body, status, admin_note, attachments, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      setMyTickets((data ?? []) as UserReport[]);
    } catch {
      setMyTickets([]);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setErr(null);
    const next = [...repFiles];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) {
        setErr(fill(t('asErrMaxShots'), { n: MAX_ATTACHMENTS }));
        break;
      }
      if (!f.type.startsWith('image/')) {
        setErr(t('asErrShotsOnly'));
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setErr(fill(t('asErrFileBig'), { name: f.name, mb: MAX_FILE_MB }));
        continue;
      }
      next.push(f);
    }
    setRepFiles(next);
  }

  async function uploadAttachments(reportId: string): Promise<string[]> {
    const sb = createClient();
    const names: string[] = [];
    for (const f of repFiles) {
      const ext = (f.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${userId}/${reportId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'png'}`;
      const { error } = await sb.storage.from('report-media').upload(path, f, {
        contentType: f.type || 'image/png',
        upsert: false,
      });
      if (error) throw new Error(`Upload failed (${f.name}): ${error.message}`);
      names.push(path);
    }
    return names;
  }

  async function sendReport() {
    setErr(null);
    if (!repBody.trim()) {
      setErr(t('asErrDescribe'));
      return;
    }
    if (openTicket) {
      setErr(t('asErrOpenTicket'));
      return;
    }
    setRepBusy(true);
    try {
      const sb = createClient();
      const { data: created, error } = await sb
        .from('reports')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          email,
          kind: repKind,
          subject: repSubject.trim(),
          body: repBody.trim(),
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      const id = (created as { id: string }).id;
      if (repFiles.length > 0) {
        const names = await uploadAttachments(id);
        await sb.from('reports').update({ attachments: names }).eq('id', id);
      }
      setRepKind('bug');
      setRepSubject('');
      setRepBody('');
      setRepFiles([]);
      setView('ticket');
      setNote(t('asNoteTicketSent'));
      await loadTickets();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('asErrReport'));
    } finally {
      setRepBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
      <button
        type="button"
        onClick={() => (view === 'main' ? router.push('/dashboard') : setView('main'))}
        aria-label={view === 'main' ? t('asBackDash') : t('asBackAccount')}
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
          <Card className="mt-4 p-5">
            <div className="flex items-center gap-4">
              <span className="relative shrink-0">
                {avatarUrl && !avatarFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Profile picture" onError={() => setAvatarFailed(true)} className="h-14 w-14 rounded-full border border-line object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink font-display text-xl font-extrabold text-paper">
                    {initial}
                  </span>
                )}
                {avatarBusy ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40" aria-hidden="true">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{email || t('asNoEmail')}</span>
                <span className="block truncate text-xs text-muted">
                  {workspaceName} · {planLabel} {t('asPlanWord')}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-muted transition hover:border-faint hover:text-ink">
                    {avatarUrl ? t('asChange') : t('asAddPhoto')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void changeAvatar(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void useGooglePicture()}
                    className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-muted transition hover:border-faint hover:text-ink"
                  >
                    {t('asUseGoogle')}
                  </button>
                  {avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => void removeAvatar()}
                      className="rounded-full px-2 py-1 text-[11px] font-bold text-muted transition hover:text-[#9F2F2D]"
                    >
                      {t('asRemove')}
                    </button>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-paper-dim px-2.5 py-1 text-[11px] font-bold text-ink">
                {role}
              </span>
            </div>
          </Card>

          <Card className="mt-3 p-5">
            <p className="text-xs font-bold text-soft">{t('asSignedIn')}</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {email} · {workspaceName} ({role})
            </p>
            <form action="/auth/signout" method="post" className="mt-3">
              <Button variant="ghost" className="w-full" type="submit">
                {t('asSignOut')}
              </Button>
            </form>
          </Card>

          <Card className="mt-3 divide-y divide-line-soft overflow-hidden">
            <Row icon={<Bell className="h-5 w-5" aria-hidden="true" />} label={t('asRowNotif')} sub={t('asRowNotifSub')} onClick={() => setView('notif')} />
            <Row icon={<Mail className="h-5 w-5" aria-hidden="true" />} label={t('asRowEmailWs')} sub={`${email || t('asSetEmail')} · ${workspaceName}`} onClick={() => { setDraftName(workspaceName); setView('email'); }} />
            <Row icon={<KeyRound className="h-5 w-5" aria-hidden="true" />} label={t('asRowPassword')} onClick={() => { setPw1(''); setPw2(''); setView('password'); }} />
          </Card>

          <Card className="mt-3 divide-y divide-line-soft overflow-hidden">
            <Row icon={<CirclePlus className="h-5 w-5" aria-hidden="true" />} label={t('asRowConnect')} sub={t('asRowConnectSub')} href="/channels" />
            <Row
              icon={<CloudUpload className="h-5 w-5" aria-hidden="true" />}
              label={t('asRowCloud')}
              sub={t('asRowCloudSub')}
              onClick={() => setCloudInfo((v) => !v)}
            />
            {cloudInfo ? (
              <p className="px-5 py-3 text-xs leading-relaxed text-muted">
                {t('asCloudInfo')}
              </p>
            ) : null}
            <Row icon={<CreditCard className="h-5 w-5" aria-hidden="true" />} label={t('asRowPlan')} sub={t('asRowPlanSub')} onClick={() => setView('plan')} />
            {role === 'owner' || role === 'admin' ? (
              <Row icon={<Users className="h-5 w-5" aria-hidden="true" />} label={t('asRowTeam')} sub={t('asRowTeamSub')} href="/team" />
            ) : null}
            <Row icon={<Star className="h-5 w-5" aria-hidden="true" />} label={t('asRowRate')} sub={t('asRowRateSub')} onClick={() => setView('report')} />
            <Row icon={<Flag className="h-5 w-5" aria-hidden="true" />} label={t('asRowSupport')} sub={openTicket ? t('asSupportOpen') : t('asSupportNew')} onClick={() => { setErr(null); setNote(null); setView('ticket'); void loadTickets(); }} />
            <Row icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label={t('asRowNew')} sub={t('asRowChangelog')} onClick={() => setView('changelog')} />
          </Card>

          <Card className="mt-3 divide-y divide-line-soft overflow-hidden">
            <Row icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} label={t('asRowPrivacy')} href="/privacy" />
            <Row icon={<FileText className="h-5 w-5" aria-hidden="true" />} label={t('asRowTerms')} href="/terms" />
            <Row icon={<Scale className="h-5 w-5" aria-hidden="true" />} label={t('asRowLegal')} onClick={() => setView('legal')} />
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{t('asAppearance')}</span>
                <span className="block text-xs text-muted">{t('asAppearanceSub')}</span>
              </span>
              <ThemeToggle />
            </div>
          </Card>

          <Card className="mt-3">
            <div className="flex w-full items-center gap-3 px-5 py-4 text-left">
              <Languages className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  Language{langSaved ? ' ✓' : ''}
                </span>
                <span className="block text-xs text-muted">Website language</span>
              </span>
              <select
                value={locale}
                onChange={(e) => void changeLang(e.target.value)}
                className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm font-semibold text-ink"
                aria-label="Language"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_META[l as keyof typeof LOCALE_META]?.name ?? l}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card className="mt-3 overflow-hidden border-red-500/40">
            <button
              type="button"
              onClick={() => { setDelArmed(false); setDelWord(''); setErr(null); setNote(null); setView('delete'); }}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <Trash2 className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-red-500">{t('asDeleteCard')}</span>
                <span className="block text-xs text-muted">{t('asDeleteCardSub')}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </button>
          </Card>
        </>
      ) : null}

      {view === 'notif' ? (
        <Card className="mt-4 divide-y divide-line-soft overflow-hidden">
          {([
            { key: 'posts', label: t('asNotifPosts'), sub: t('asNotifPostsSub') },
            { key: 'comments', label: t('asNotifComments'), sub: t('asNotifCommentsSub') },
            { key: 'weekly', label: t('asNotifWeekly'), sub: t('asNotifWeeklySub') },
            { key: 'marketing', label: t('asNotifMarketing'), sub: t('asNotifMarketingSub') },
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
            {fill(t('asNotifSaved'), { check: notifSaved ? ' ✓' : '' })}
          </p>
        </Card>
      ) : null}

      {view === 'email' ? (
        <Card className="mt-4 space-y-3 p-5">
          <div>
            <p className="text-xs font-bold text-muted">{t('asEmail')}</p>
            <p className="mt-1 text-sm font-bold">{email || t('asNoEmail')}</p>
            <p className="mt-0.5 text-[11px] text-faint">{t('asEmailManaged')}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-muted">{t('asTeamOrg')}</p>
            {canRename ? (
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={t('tmTeamPh')}
                aria-label={t('asWsNameAria')}
                className="field mt-1"
              />
            ) : (
              <p className="mt-1 text-sm font-bold">{workspaceName}</p>
            )}
            {!canRename ? (
              <p className="mt-0.5 text-[11px] text-faint">{t('asRenameOnly')}</p>
            ) : null}
          </div>
          {canRename ? (
            <Button onClick={() => void saveName()} disabled={busy} className="w-full">
              {busy ? t('tmSaving') : t('tmSave')}
            </Button>
          ) : null}
        </Card>
      ) : null}

      {view === 'password' ? (
        <Card className="mt-4 space-y-3 p-5">
          <div>
            <p className="text-xs font-bold text-muted">{t('asNewPw')}</p>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-label={t('asNewPw')}
              className="field mt-1"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-muted">{t('asConfirm')}</p>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-label={t('asConfirmPwAria')}
              className="field mt-1"
            />
          </div>
          <Button onClick={() => void savePassword()} disabled={busy} className="w-full">
            {busy ? t('asUpdating') : t('asUpdatePw')}
          </Button>
        </Card>
      ) : null}

      {view === 'plan' ? (
        <div className="mt-4 space-y-3">
          {/* Plan cards derive from the canonical price book, never hardcoded. */}
          {PLAN_ORDER.map((key, i) => {
            const def = PLANS[key];
            const p = {
              name: def.label,
              price: key === 'free' ? t('asPriceFree') : priceLabel(key, 'monthly'),
              sub:
                key === 'free'
                  ? undefined
                  : `${priceLabel(key, 'annual')} ${t('blAnnual')}, ≈ $${monthlyEquivalent(key)}/month, ${t('blBilledYearly')}`,
              also: i === 0 ? undefined : fill(t('asEverythingIn'), { plan: PLANS[PLAN_ORDER[i - 1]].label }),
              features: def.points,
            };
            return p;
          }).map((p) => (
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
            {t('asManageBilling')}
          </Link>
          <Link href="/pricing" className="btn btn-ghost w-full">
            {t('asSeePricing')}
          </Link>
        </div>
      ) : null}

      {view === 'ticket' ? (
        myTickets === null ? (
          <Card className="mt-4 p-6 text-center text-sm text-muted">{t('asLoading')}</Card>
        ) : openTicket ? (
          <div className="mt-4 space-y-3">
            {openTicket.attachments?.length ? (
              <Card className="p-5">
                <p className="text-xs font-bold text-muted">{t('asYourShots')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {openTicket.attachments.map((p) => (
                    <TicketImage key={p} path={p} userId={userId} />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-faint">{t('asAttachNote')}</p>
              </Card>
            ) : null}
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-bold ${TICKET_STATUSES[openTicket.status]?.tone ?? 'bg-paper-dim text-muted'}`}>
                  {TICKET_STATUSES[openTicket.status] ? t(TICKET_STATUSES[openTicket.status].label) : openTicket.status}
                </span>
                <span className="rounded-full border border-line bg-paper px-2.5 py-1 font-bold text-soft capitalize">{openTicket.kind}</span>
                <span className="min-w-0 flex-1 text-right text-muted">{new Date(openTicket.created_at).toLocaleDateString()}</span>
              </div>
              {openTicket.subject ? (
                <h3 className="mt-3 font-display text-base font-extrabold">{openTicket.subject}</h3>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-soft">{openTicket.body}</p>
              {openTicket.admin_note ? (
                <div className="mt-4 rounded-xl bg-paper-dim px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{t('asSupportReply')}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-soft">{openTicket.admin_note}</p>
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted">{t('asReplyNote')}</p>
              )}
            </Card>
            <Card className="p-5">
              <p className="text-xs leading-relaxed text-muted">
                {t('asTicketInfo')}
              </p>
            </Card>
          </div>
        ) : (
          <Card className="mt-4 space-y-3 p-5">
            <p className="text-xs leading-relaxed text-muted">
              {t('asNewTicketInfo')}
            </p>
            <SegmentedPills
              ariaLabel={t('asReportKindAria')}
              size="sm"
              buttonClassName="flex-1 capitalize"
              value={repKind}
              onChange={setRepKind}
              options={(['bug', 'idea', 'billing', 'other'] as const).map((k) => ({ value: k, label: k }))}
            />
            <input
              value={repSubject}
              onChange={(e) => setRepSubject(e.target.value)}
              placeholder={t('asSubjectPh')}
              aria-label={t('asSubjectAria')}
              className="field !text-xs"
            />
            <textarea
              value={repBody}
              onChange={(e) => setRepBody(e.target.value)}
              placeholder={t('asDetailsPh')}
              rows={5}
              aria-label={t('asDetailsAria')}
              className="field min-h-[120px] resize-y !text-xs"
            />
            {repFiles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {repFiles.map((f, i) => (
                  <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-full border border-line bg-paper-dim px-2.5 py-1 text-[11px] font-bold text-soft">
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={fill(t('asRemoveFile'), { name: f.name })}
                      onClick={() => setRepFiles(repFiles.filter((_, j) => j !== i))}
                      className="text-faint transition hover:text-ink"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-xs font-bold text-muted transition hover:border-faint hover:text-ink">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              {fill(t('asAttach'), { n: MAX_ATTACHMENTS, mb: MAX_FILE_MB })}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </label>
            <Button onClick={() => void sendReport()} disabled={repBusy} className="w-full">
              <Send className="h-4 w-4" aria-hidden="true" />
              {repBusy ? t('tmSending') : t('asSubmitTicket')}
            </Button>
          </Card>
        )
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

      {view === 'delete' ? (
        <Card className="mt-4 border-red-500/40 p-5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-red-500">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('asDeleteBanner')}
          </p>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted">
            <li>{t('asDelWs')}</li>
            <li>{t('asDelTeammates')}</li>
            <li>{t('asDelMemberships')}</li>
            <li>{t('asDelTokens')}</li>
            <li>{t('asDelSubs')}</li>
          </ul>
          {!delArmed ? (
            <Button
              variant="outline"
              className="mt-4 w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
              onClick={() => { setDelArmed(true); setErr(null); }}
            >
              {t('asDelUnderstand')}
            </Button>
          ) : (
            <>
              <p className="mt-4 text-xs font-bold text-soft">
                {t('asDelType')}
              </p>
              <input
                value={delWord}
                onChange={(e) => setDelWord(e.target.value)}
                placeholder="confirm"
                autoComplete="off"
                aria-label={t('asDelTypeAria')}
                className="field mt-2 !text-xs"
              />
              <Button
                className="mt-3 w-full bg-red-600 text-white hover:bg-red-700"
                disabled={delBusy || delWord.trim().toLowerCase() !== 'confirm'}
                onClick={() => void deleteMyData()}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {delBusy ? t('asDeleting') : t('asDelForever')}
              </Button>
            </>
          )}
        </Card>
      ) : null}

      {view === 'legal' ? (
        <Card className="mt-4 p-5">
          <p className="text-sm leading-relaxed text-soft">
            {t('asLegal1')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-soft">
            {t('asLegal2')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-soft">
            {t('asLegal3')}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
