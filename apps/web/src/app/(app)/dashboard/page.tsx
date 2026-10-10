import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChartColumn, Clock, Link2 } from 'lucide-react';
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
import { fetchChannels, fetchMediaForPosts, fetchPostsLite } from '@/lib/posts';
import { addDays, dayKey } from '@/lib/format';
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
    <Card className="p-4 sm:p-5">
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
    </Card>
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

  // Carousel slides: social-style author (real handles only — never numeric
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
    posts.map((p) => p.id),
  );
  const recentItems: RecentActivityItem[] = recentFeed.map(({ p }) => {
    const t0 = p.post_targets?.[0];
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
          ? `${fmtDay(p.scheduled_at)}, ${fmtTime(p.scheduled_at)}`
          : timeAgo(p.created_at)
        : timeAgo(p.sent_at ?? p.created_at),
      timeTitle: when ? `${fmtDay(when)}, ${fmtTime(when)}` : '',
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
          label="Total posts"
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

          {/* Content calendar — Schedule-X week in the same skin as /calendar */}
          <Card className="overflow-hidden" aria-label="Content calendar">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
              <p className="font-display text-base font-extrabold tracking-tight">Content calendar</p>
              <p className="text-xs text-muted">This week</p>
              <span className="flex-1" />
              <span className="flex items-center gap-3 text-[11px] font-bold text-muted">
                {[
                  ['Draft', 'bg-[#9A958B]'],
                  ['Queued', 'bg-[#B45309]'],
                  ['Sent', 'bg-[#12914A]'],
                  ['Failed', 'bg-[#E5484D]'],
                ].map(([label, dot]) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </span>
              <Link
                href="/calendar"
                className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-paper-dim"
              >
                Open calendar
              </Link>
            </div>
            <div className="px-5 py-4">
              <ScheduleXBoard variant="mini" posts={posts} channels={channels} media={mediaMap} />
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* Recent activity */}
          <Card className="p-5" aria-label="Recent activity">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Recent activity</p>
              <Link href="/queue" className="text-xs font-bold text-ink hover:underline">
                View all
              </Link>
            </div>
            {recentFeed.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing here yet. Publish or queue a post and it lands here.</p>
            ) : (
              <DashboardRecentActivity items={recentItems} />
            )}
          </Card>

          {/* Analytics snapshot */}
          <AnalyticsCard
            sentAt={posts
              .filter(
                (p) =>
                  (p.status === 'sent' || p.status === 'partial') && p.sent_at,
              )
              .map((p) => p.sent_at as string)}
          />

        </div>
      </div>
    </div>
  );
}
