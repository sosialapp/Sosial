import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChartColumn, Clock, Link2, Plus } from 'lucide-react';
import ChannelAvatar from '@/components/ChannelAvatar';
import SendIcon from '@/components/SendIcon';
import { channelAvatar } from '@/lib/channelAvatar';
import AnalyticsCard from '@/components/AnalyticsCard';
import DashboardRecentActivity from '@/components/DashboardRecentActivity';
import QuickPost from '@/components/QuickPost';
import type { RecentActivityItem } from '@/components/RecentActivityCarousel';
import ScheduleXBoard from '@/components/ScheduleXBoard';
import { Card } from '@/components/ui/card';
import { providerMeta } from '@/lib/providers';
import { chainPartsByChain, isChainHead } from '@/lib/chains';
import { primaryTarget } from '@/lib/postTargets';
import { fetchChannels, fetchMediaForPosts, fetchPostsLite } from '@/lib/posts';
import { addDays, dayKey } from '@/lib/format';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { translator, fill, type Locale } from '@/lib/i18n/locales';
import { appMessages } from '@/lib/i18n/app';

export const metadata = { title: 'Dashboard' };


export const dynamic = 'force-dynamic';

const greeting = (locale: Locale): string => {
  const h = new Date().getHours();
  const t = translator(appMessages, locale);
  if (h < 5) return t('gLate');
  if (h < 12) return t('gMorning');
  if (h < 18) return t('gAfternoon');
  return t('gEvening');
};

const timeAgo = (iso: string | null, t: (k: string) => string): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t('justNow');
  if (m < 60) return fill(t('agoMin'), { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return fill(t('agoHour'), { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t('yesterday') : fill(t('agoDay'), { n: d });
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const fmtDay = (iso: string | null, t: (k: string) => string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = dayKey(new Date());
  const tomorrow = dayKey(addDays(new Date(), 1));
  const k = dayKey(d);
  if (k === today) return t('today');
  if (k === tomorrow) return t('tomorrow');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Home: date + greeting, a KPI strip, compose and this week on the left;
 *  recent activity, the analytics snapshot and channel health on the right. */
export default async function DashboardPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const locale = await getLocale();
  const t = translator(appMessages, locale);
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);

  const now = Date.now();
  const dayMs = 24 * 3600_000;
  // Chains read as one post everywhere: group by chain_id, keep the head.
  const parts = chainPartsByChain(posts);
  const avatarByChannel = new Map(channels.map((c) => [c.id, channelAvatar(c.metadata)]));
  const avatarOf = (channelId: string): string | undefined => avatarByChannel.get(channelId);
  const queued = posts.filter((p) => p.status === 'queued' || p.status === 'publishing');
  const queuedHeads = queued.filter((p) => isChainHead(p, parts));
  const sentWeek = posts.filter(
    (p) =>
      (p.status === 'sent' || p.status === 'partial') &&
      p.sent_at &&
      now - new Date(p.sent_at).getTime() < 7 * dayMs,
  );
  const sentPrevWeek = posts.filter((p) => {
    if (p.status !== 'sent' && p.status !== 'partial') return false;
    if (!p.sent_at) return false;
    const age = now - new Date(p.sent_at).getTime();
    return age >= 7 * dayMs && age < 14 * dayMs;
  });
  const live = channels.filter((c) => c.status === 'connected');
  /** Recent activity: latest publishes, failures and queue additions, newest first. */
  const recentFeed = [
    ...posts
      .filter((p) => p.sent_at || p.status === 'failed')
      .map((p) => ({ p, t: p.sent_at ?? p.created_at ?? '' })),
    ...queuedHeads
      .filter((p) => !p.sent_at && p.status !== 'failed')
      .map((p) => ({ p, t: p.created_at ?? '' })),
  ]
    .sort((a, b) => b.t.localeCompare(a.t))
    .slice(0, 5);

  // Carousel slides: social-style author (real handles only, never numeric
  // ids or site URLs) + signed media for just these posts.
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const cleanHandle = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const t = raw.trim().replace(/^@+/, '');
    if (!t) return null;
    if (t.includes('://') || t.includes('/') || t.includes(' ') || t.includes('\\')) return null;
    if (/^\d+$/.test(t)) return null;
    if (t.length > 64) return null;
    return `@${t}`;
  };
  const authorOf = (channelId: string, provider: string) => {
    const c = channelById.get(channelId);
    const display = c?.display_name?.trim() || providerMeta(provider).label;
    const handle = cleanHandle(c?.handle) ?? (display.startsWith('@') ? cleanHandle(display) : null);
    return { name: display.replace(/^@+/, '') || display, handle };
  };
  const mediaMap = await fetchMediaForPosts(
    sb,
    ctx.workspace.id,
    recentFeed.map(({ p }) => p.id),
  );
  const recentItems: RecentActivityItem[] = recentFeed.map(({ p }) => {
    const t0 = primaryTarget(p);
    const provider = t0?.provider ?? 'instagram';
    const author = t0 ? authorOf(t0.channel_id, provider) : { name: providerMeta(provider).label, handle: null };
    const isQueued = p.status === 'queued' || p.status === 'publishing';
    const when = p.sent_at ?? p.scheduled_at ?? p.created_at ?? '';
    return {
      id: p.id,
      text: p.body || p.title || '',
      status: p.status,
      timeLabel: isQueued
        ? p.scheduled_at
          ? `${fmtDay(p.scheduled_at, t)}, ${fmtTime(p.scheduled_at)}`
          : timeAgo(p.created_at, t)
        : timeAgo(p.sent_at ?? p.created_at, t),
      timeTitle: when ? `${fmtDay(when, t)}, ${fmtTime(when)}` : '',
      provider,
      authorName: author.name,
      authorHandle: author.handle,
      avatar: t0 ? avatarOf(t0.channel_id) : undefined,
      media: mediaMap[p.id] ?? [],
    };
  });

  const delta =
    sentPrevWeek.length > 0
      ? Math.round(((sentWeek.length - sentPrevWeek.length) / sentPrevWeek.length) * 100)
      : null;

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const nextUp = [...queuedHeads]
    .filter((p) => p.scheduled_at)
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))[0];

  const kpis: { label: string; value: string; sub: string; tone?: 'up' | 'down' | null; icon: React.ReactNode }[] = [
    {
      label: t('stWeek'),
      value: String(sentWeek.length),
      sub: delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% ${t('vsLast7')}` : t('vsLast7'),
      tone: delta === null ? null : delta >= 0 ? 'up' : 'down',
      icon: <SendIcon className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: t('stScheduled'),
      value: String(queuedHeads.length),
      sub: nextUp?.scheduled_at ? `Next ${fmtDay(nextUp.scheduled_at, t)}, ${fmtTime(nextUp.scheduled_at)}` : t('inQueue'),
      icon: <Clock className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: t('stTotal'),
      value: String(posts.length),
      sub: t('dashSub'),
      icon: <ChartColumn className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: t('stLive'),
      value: `${live.length}/${channels.length}`,
      sub: t('connectedAccts'),
      icon: <Link2 className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return (
    <div className="w-full pt-3 sm:px-2 sm:pt-4">
      {/* Greeting with today's date; the two most-used doors on the right. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted">{today}</p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting(locale)}, {ctx.workspace.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-bold text-soft transition hover:bg-surface"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {t('openCalendar')}
          </Link>
          <Link href="/post" className="btn btn-bolt btn-sm !h-9">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('cNewPost')}
          </Link>
        </div>
      </div>

      {/* KPIs: one strip with hairline dividers instead of four loose tiles. */}
      <Card className="mt-5 grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={`p-4 sm:p-5 ${i % 2 === 1 ? 'border-l border-line' : ''} ${i > 1 ? 'border-t border-line lg:border-t-0' : ''} ${
              i > 0 ? 'lg:border-l lg:border-line' : ''
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
              {k.icon}
              {k.label}
            </p>
            <p className="mt-2 font-display text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[2rem]">
              {k.value}
            </p>
            <p
              className={`mt-1.5 truncate text-[11px] font-bold ${
                k.tone === 'up' ? 'text-[#12914A]' : k.tone === 'down' ? 'text-[#E5484D]' : 'text-faint'
              }`}
            >
              {k.sub}
            </p>
          </div>
        ))}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <QuickPost channels={channels} workspaceId={ctx.workspace.id} userId={ctx.user.id} role={ctx.workspace.role} />

          {/* This week: seven day columns (swipeable on a phone), drag posts between days. */}
          <Card className="overflow-hidden" aria-label={t('contentCalendar')}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-4">
              <p className="font-display text-base font-extrabold tracking-tight">{t('contentCalendar')}</p>
              <span className="flex-1" />
              <span className="hidden items-center gap-3 text-[11px] font-bold text-muted sm:flex">
                {[
                  [t('stDraft'), 'bg-[#9A958B]'],
                  [t('stQueued'), 'bg-[#B45309]'],
                  [t('stSent'), 'bg-[#12914A]'],
                  [t('stFailed'), 'bg-[#E5484D]'],
                ].map(([label, dot]) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </span>
            </div>
            <div className="px-5 py-4">
              <ScheduleXBoard variant="mini" posts={posts} channels={channels} media={mediaMap} />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-5" aria-label={t('recentActivity')}>
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">{t('recentActivity')}</p>
              <Link href="/queue" className="text-xs font-bold text-ink hover:underline">
                {t('viewAll')}
              </Link>
            </div>
            {recentFeed.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('nothingYet')}</p>
            ) : (
              <DashboardRecentActivity items={recentItems} />
            )}
          </Card>

          <AnalyticsCard
            sentAt={posts.filter((p) => (p.status === 'sent' || p.status === 'partial') && p.sent_at).map((p) => p.sent_at as string)}
          />

          {/* Channels at a glance: who is live and who needs a reconnect. */}
          <Card className="p-5" aria-label={t('connectedAccts')}>
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">{t('connectedAccts')}</p>
              <Link href="/channels" className="text-xs font-bold text-ink hover:underline">
                {t('viewAll')}
              </Link>
            </div>
            {channels.length === 0 ? (
              <Link href="/channels" className="btn btn-bolt btn-sm mt-3 w-full justify-center">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Connect a channel
              </Link>
            ) : (
              <ul className="mt-3 space-y-1">
                {channels.slice(0, 6).map((c) => {
                  const ok = c.status === 'connected';
                  return (
                    <li key={c.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                      <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{c.display_name || providerMeta(c.provider).label}</span>
                        <span className="block truncate text-[11px] text-muted">{providerMeta(c.provider).label}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ok ? 'bg-[#EDF3EC] text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]' : 'bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-[#12914A]' : 'bg-[#E5484D]'}`} aria-hidden="true" />
                        {ok ? 'Live' : 'Reconnect'}
                      </span>
                    </li>
                  );
                })}
                {channels.length > 6 ? (
                  <li className="px-1 pt-1 text-xs font-bold text-muted">+{channels.length - 6} more</li>
                ) : null}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
