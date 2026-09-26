import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChartColumn, ChevronLeft, ChevronRight, Clock, Link2 } from 'lucide-react';
import SendIcon from '@/components/SendIcon';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import AnalyticsCard from '@/components/AnalyticsCard';
import QuickPost from '@/components/QuickPost';
import PostPeek from '@/components/PostPeek';
import { providerMeta } from '@/lib/providers';
import { chainPartsByChain, isChainHead, threadCount } from '@/lib/chains';
import { fetchChannels, fetchPostsLite } from '@/lib/posts';
import { addDays, dayKey, WEEKDAYS } from '@/lib/format';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const timeAgo = (iso: string | null): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const fmtDay = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = dayKey(new Date());
  const tomorrow = dayKey(addDays(new Date(), 1));
  const k = dayKey(d);
  if (k === today) return 'Today';
  if (k === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function StatTile({
  label,
  value,
  sub,
  tint,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${tint}1A`, color: tint }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <p className="text-xs font-bold text-muted">{label}</p>
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] text-faint">{sub}</p>
    </div>
  );
}

/** Home: greeting, stats, compose, calendar week, activity, right rail. */
export default async function DashboardPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
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
  const avatarRecord: Record<string, string> = {};
  for (const [id, v] of avatarByChannel) {
    if (typeof v === 'string') avatarRecord[id] = v;
  }
  const queued = posts.filter((p) => p.status === 'queued' || p.status === 'publishing');
  const queuedHeads = queued.filter((p) => isChainHead(p, parts));
  const upcoming = queuedHeads
    .filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() >= now - 60_000)
    .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!))
    .slice(0, 5);
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
    .slice(0, 6);

  const delta =
    sentPrevWeek.length > 0
      ? Math.round(((sentWeek.length - sentPrevWeek.length) / sentPrevWeek.length) * 100)
      : null;

  // Week strip: Mon..Sun of the current week.
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = addDays(today, -mondayOffset);
  const sunday = addDays(monday, 6);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const k = dayKey(d);
    const dayPosts = queuedHeads
      .filter((p) => p.scheduled_at && dayKey(new Date(p.scheduled_at)) === k)
      .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!));
    return { d, k, posts: dayPosts, isToday: k === dayKey(today) };
  });
  const rangeLabel = `${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Time axis: 2-hour rows from 6 AM to 10 PM; events bucket into the nearest row.
  const HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  const hourLabel = (h: number) => {
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh} ${ap}`;
  };
  const rowFor = (iso: string): number => {
    const h = new Date(iso).getHours();
    if (h <= HOURS[0]) return HOURS[0];
    for (let i = HOURS.length - 1; i >= 0; i--) {
      if (h >= HOURS[i]) return HOURS[i];
    }
    return HOURS[0];
  };

  return (
    <div className="w-full pt-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {greeting()}, {ctx.workspace.name} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening with your content today.</p>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Total Posts"
          value={String(posts.length)}
          sub={delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% vs. last 7 days` : 'vs. last 7 days'}
          tint="#1d7fe0"
          icon={<ChartColumn className="h-4.5 w-4.5" aria-hidden="true" />}
        />
        <StatTile
          label="Sent this week"
          value={String(sentWeek.length)}
          sub="vs. last 7 days"
          tint="#12914a"
          icon={<SendIcon className="h-4.5 w-4.5" aria-hidden="true" />}
        />
        <StatTile
          label="Scheduled"
          value={String(queuedHeads.length)}
          sub="In the queue now"
          tint="#7c5cf0"
          icon={<Clock className="h-4.5 w-4.5" aria-hidden="true" />}
        />
        <StatTile
          label="Channels live"
          value={`${live.length}/${channels.length}`}
          sub="Connected accounts"
          tint="#E1306C"
          icon={<Link2 className="h-4.5 w-4.5" aria-hidden="true" />}
        />
      </div>

      {/* Main + right rail */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Quick post */}
          <QuickPost
            channels={channels}
            workspaceId={ctx.workspace.id}
            userId={ctx.user.id}
            role={ctx.workspace.role}
          />

          {/* Week calendar */}
          <section className="card overflow-hidden p-5" aria-label="Content calendar">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-extrabold tracking-tight">Content Calendar</p>
              <p className="text-xs text-muted">{rangeLabel}</p>
              <span className="flex-1" />
              <Link
                href="/calendar"
                aria-label="Previous week"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/calendar"
                aria-label="Next week"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {/* Week time-grid: hour gutter + seven day columns, one aligned grid. */}
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Day header row */}
                <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] pb-2">
                  <span />
                  {week.map(({ d, k, isToday }) => (
                    <div key={k} className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-bold text-faint">
                        {WEEKDAYS[(d.getDay() + 6) % 7]?.slice(0, 3) ?? ''}
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-xs font-extrabold ${
                          isToday ? 'bg-accent text-white' : 'text-ink'
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Hour rows */}
                {HOURS.map((h, ri) => (
                  <div key={h} className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
                    <span
                      className={`pr-2 text-right text-[10px] font-medium text-faint ${
                        ri === 0 ? '' : '-translate-y-1'
                      }`}
                    >
                      {hourLabel(h)}
                    </span>
                    {week.map(({ k, posts: dayPosts, isToday }) => {
                      const cell = dayPosts.filter((p) => rowFor(p.scheduled_at!) === h);
                      return (
                        <div
                          key={k}
                          className={`border-t border-line-soft p-1 text-[10px] [&:not(:first-child)]:border-l ${
                            isToday ? 'bg-accent/[0.06]' : ''
                          } ${ri === HOURS.length - 1 ? 'border-b' : ''}`}
                          style={{ height: '4.5rem' }}
                        >
                          {cell.slice(0, 2).map((p) => (
                            <PostPeek
                              key={p.id}
                              post={{
                                id: p.id,
                                title: p.title,
                                body: p.body,
                                scheduled_at: p.scheduled_at,
                                status: p.status,
                                targets: (p.post_targets ?? []).map((t) => ({
                                  provider: t.provider,
                                  channel_id: t.channel_id,
                                })),
                              }}
                              when={`${fmtDay(p.scheduled_at)}, ${fmtTime(p.scheduled_at)}`}
                              avatars={avatarRecord}
                              threadParts={threadCount(p, parts)}
                            />
                          ))}
                          {cell.length > 2 ? (
                            <span className="block px-1 text-[9px] font-bold text-muted">+{cell.length - 2} more</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* Analytics snapshot */}
          <AnalyticsCard
            sentAt={posts
              .filter(
                (p) =>
                  (p.status === 'sent' || p.status === 'partial') && p.sent_at,
              )
              .map((p) => p.sent_at as string)}
          />

          {/* Recent activity */}
          <section className="card p-5" aria-label="Recent activity">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Recent Activity</p>
              <Link href="/queue" className="text-xs font-bold text-ink hover:underline">
                View all
              </Link>
            </div>
            {recentFeed.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing here yet. Publish or queue a post and it lands here.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {recentFeed.map(({ p }) => {
                  const t0 = p.post_targets?.[0];
                  const pv = t0?.provider ?? 'instagram';
                  const meta = providerMeta(pv);
                  const failed = p.status === 'failed';
                  const isQueued = p.status === 'queued' || p.status === 'publishing';
                  return (
                    <li key={p.id} className="flex items-center gap-3">
                      <ChannelAvatar
                        provider={pv}
                        avatar={t0 ? avatarOf(t0.channel_id) : undefined}
                        size={40}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">
                          {failed ? 'Failed on ' : isQueued ? 'Queued on ' : 'Posted on '}
                          {meta.label}
                        </span>
                        <span className="block truncate text-xs text-soft">
                          {p.title || 'Untitled post'}
                        </span>
                        <span className="block text-[11px] text-faint">
                          {failed
                            ? 'Failed to send. Retry from the queue.'
                            : isQueued
                              ? `Goes out ${fmtDay(p.scheduled_at)}, ${fmtTime(p.scheduled_at)}`
                              : timeAgo(p.sent_at)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Upcoming */}
          <section className="card p-5" aria-label="Upcoming posts">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Upcoming Posts</p>
              <Link href="/calendar" className="text-xs font-bold text-ink hover:underline">
                View all
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nothing scheduled right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line-soft">
                {upcoming.map((p) => {
                  const t0 = p.post_targets?.[0];
                  const pv = t0?.provider ?? 'instagram';
                  const meta = providerMeta(pv);
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <ChannelAvatar
                        provider={pv}
                        avatar={t0 ? avatarOf(t0.channel_id) : undefined}
                        size={40}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-bold text-ink">
                          {meta.label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-bold">{p.title || 'Untitled post'}</span>
                        <span className="block text-[11px] text-faint">
                          {fmtDay(p.scheduled_at)}, {fmtTime(p.scheduled_at)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Needs attention, only when something is actually wrong */}
          {(() => {
            const failed = posts.filter((p) => p.status === 'failed');
            const approvals = posts.filter((p) => p.status === 'approval');
            const sick = channels.filter((c) => c.status !== 'connected');
            const total = failed.length + approvals.length + sick.length;
            if (total === 0) return null;
            return (
              <section className="card p-5" aria-label="Needs attention">
                <p className="font-display text-base font-extrabold tracking-tight">Needs attention</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {failed.slice(0, 2).map((p) => (
                    <li key={p.id}>
                      <Link href="/queue" className="block truncate font-bold hover:text-ink">
                        {p.title || 'Untitled post'}
                      </Link>
                      <p className="text-xs text-muted">Failed to send. Retry from the queue.</p>
                    </li>
                  ))}
                  {approvals.slice(0, 2).map((p) => (
                    <li key={p.id}>
                      <Link href="/queue" className="block truncate font-bold hover:text-ink">
                        {p.title || 'Untitled post'}
                      </Link>
                      <p className="text-xs text-muted">Waiting for approval.</p>
                    </li>
                  ))}
                  {sick.slice(0, 3).map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={22} badge={false} />
                      <span className="truncate font-bold">{providerMeta(c.provider).label}</span>
                      <span className="text-xs text-muted">{c.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
