import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import AnalyticsCard from '@/components/AnalyticsCard';
import QuickPost from '@/components/QuickPost';
import { providerMeta } from '@/lib/providers';
import { fetchChannels, fetchPostsLite } from '@/lib/posts';
import { addDays, dayKey, WEEKDAYS } from '@/lib/format';
import type { ProviderKey } from '@/lib/types';
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

function ThumbSlot({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-paper-dim text-faint ${className}`}
      aria-hidden="true"
    >
      <span className="text-lg leading-none">+</span>
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
  const queued = posts.filter((p) => p.status === 'queued' || p.status === 'publishing');
  const upcoming = queued
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
  const recent = posts
    .filter((p) => p.sent_at || p.status === 'failed')
    .sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))
    .slice(0, 4);

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
    const dayPosts = queued
      .filter((p) => p.scheduled_at && dayKey(new Date(p.scheduled_at)) === k)
      .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!));
    return { d, k, posts: dayPosts, isToday: k === dayKey(today) };
  });
  const rangeLabel = `${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

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
          icon={
            <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 16V8.5M10 16V4M16 16v-5" />
            </svg>
          }
        />
        <StatTile
          label="Sent this week"
          value={String(sentWeek.length)}
          sub="vs. last 7 days"
          tint="#12914a"
          icon={
            <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 10 17 3.5 13.5 16.5 9 11.5 3.5 10Z" />
            </svg>
          }
        />
        <StatTile
          label="Scheduled"
          value={String(queued.length)}
          sub="In the queue now"
          tint="#7c5cf0"
          icon={
            <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="6.5" />
              <path d="M10 6.5V10l2.5 1.5" />
            </svg>
          }
        />
        <StatTile
          label="Channels live"
          value={`${live.length}/${channels.length}`}
          sub="Connected accounts"
          tint="#E1306C"
          icon={
            <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.2 11.8a3.2 3.2 0 0 0 4.5 0l2.3-2.3a3.2 3.2 0 0 0-4.5-4.5l-1 1" />
              <path d="M11.8 8.2a3.2 3.2 0 0 0-4.5 0L5 10.5a3.2 3.2 0 0 0 4.5 4.5l1-1" />
            </svg>
          }
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
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m12.5 4.5-6 5.5 6 5.5" />
                </svg>
              </Link>
              <Link
                href="/calendar"
                aria-label="Next week"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m7.5 4.5 6 5.5-6 5.5" />
                </svg>
              </Link>
            </div>

            {/* Week board: seven self-contained day columns. */}
            <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
              {week.map(({ d, k, posts: dayPosts, isToday }) => (
                <div
                  key={k}
                  className={`flex min-h-[150px] flex-col rounded-xl border p-1.5 sm:p-2 ${
                    isToday ? 'border-[#2f7cf6]/50 bg-[#2f7cf6]/[0.04]' : 'border-line bg-paper'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-faint">
                      {WEEKDAYS[(d.getDay() + 6) % 7]?.slice(0, 3) ?? ''}
                    </span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-xs font-extrabold ${
                        isToday ? 'bg-[#2f7cf6] text-white' : 'text-ink'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-1 flex-col gap-1">
                    {dayPosts.slice(0, 3).map((p) => {
                      const pv = p.post_targets?.[0]?.provider;
                      const meta = pv ? providerMeta(pv) : null;
                      return (
                        <Link
                          key={p.id}
                          href="/calendar"
                          className="block rounded-lg px-1.5 py-1 transition hover:opacity-85"
                          style={meta ? { background: `${meta.color}1A` } : undefined}
                        >
                          <span className="flex items-center gap-1">
                            {pv ? (
                              <BrandIcon provider={pv as ProviderKey} className="h-2.5 w-2.5 shrink-0" />
                            ) : null}
                            <span
                              className="truncate text-[10px] font-extrabold"
                              style={meta ? { color: meta.color } : undefined}
                            >
                              {fmtTime(p.scheduled_at)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-soft">
                            {p.title || 'Untitled post'}
                          </span>
                        </Link>
                      );
                    })}
                    {dayPosts.length > 3 ? (
                      <span className="px-1 text-[10px] font-bold text-muted">+{dayPosts.length - 3} more</span>
                    ) : null}
                    {dayPosts.length === 0 ? (
                      <span className="mt-auto pb-0.5 text-center text-[10px] text-faint" aria-hidden="true">
                        —
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
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
                  const pv = (p.post_targets?.[0]?.provider ?? 'instagram') as ProviderKey;
                  const meta = providerMeta(pv);
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      {/* Picture area: filled in later. */}
                      <ThumbSlot className="h-10 w-10 !rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <BrandIcon provider={pv} className="h-4 w-4 shrink-0" />
                          <span className="truncate text-[11px] font-bold" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
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

          {/* Analytics snapshot */}
          <AnalyticsCard
            sentAt={posts
              .filter(
                (p) =>
                  (p.status === 'sent' || p.status === 'partial') && p.sent_at,
              )
              .map((p) => p.sent_at as string)}
          />

          {/* Content library */}
          <section className="card p-5" aria-label="Content library">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Content Library</p>
              <Link href="/new?tab=templates" className="text-xs font-bold text-ink hover:underline">
                View all
              </Link>
            </div>
            {/* Picture area: filled in later. */}
            <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
              <ThumbSlot className="aspect-square" />
              <ThumbSlot className="aspect-square" />
              <ThumbSlot className="aspect-square" />
              <ThumbSlot className="aspect-square" />
            </div>
            <Link
              href="/new?tab=templates"
              aria-label="Add to library"
              className="mt-3 flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-line text-muted transition hover:border-ink hover:text-ink"
            >
              +
            </Link>
          </section>

          {/* Recent activity */}
          <section className="card p-5" aria-label="Recent activity">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Recent Activity</p>
              <Link href="/queue" className="text-xs font-bold text-ink hover:underline">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing sent yet. Queue a post and it lands here.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {recent.map((p) => {
                  const pv = (p.post_targets?.[0]?.provider ?? 'instagram') as ProviderKey;
                  const meta = providerMeta(pv);
                  const failed = p.status === 'failed';
                  return (
                    <li key={p.id} className="flex items-center gap-3">
                      <BrandIcon provider={pv} className="h-10 w-10 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">
                          {failed ? 'Failed on ' : 'Posted on '}
                          {meta.label}
                        </span>
                        <span className="block truncate text-xs text-soft">
                          {p.title || 'Untitled post'}
                        </span>
                        <span className="block text-[11px] text-faint">{timeAgo(p.sent_at)}</span>
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
                      <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={22} />
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
