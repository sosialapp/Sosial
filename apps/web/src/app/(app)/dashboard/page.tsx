import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import { ImageSlot } from '@/components/ui';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
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
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const k = dayKey(d);
    const dayPosts = queued.filter((p) => p.scheduled_at && dayKey(new Date(p.scheduled_at)) === k);
    return { d, k, posts: dayPosts, isToday: k === dayKey(today) };
  });

  const composeChannels = live.slice(0, 5);

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
          {/* Compose + AI */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className="card p-5" aria-label="Create new post">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-base font-extrabold tracking-tight">Create new post</p>
                  <p className="mt-0.5 text-xs text-muted">Write something, add media, choose channels.</p>
                </div>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.5 3.5 16.5 6.5 7 16l-4 1 1-4L13.5 3.5Z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {composeChannels.map((c) => (
                  <span
                    key={c.id}
                    title={c.display_name ?? providerMeta(c.provider).label}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-dim ring-1 ring-line"
                  >
                    <BrandIcon provider={c.provider as ProviderKey} className="h-4.5 w-4.5" />
                  </span>
                ))}
                <Link
                  href="/channels"
                  aria-label="Add channel"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-line text-muted transition hover:border-ink hover:text-ink"
                >
                  +
                </Link>
              </div>
              <div className="mt-3 min-h-[72px] rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-faint">
                What&apos;s on your mind?
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {['Photo', 'Video', 'Thread', 'AI Generate'].map((t) => (
                  <Link
                    key={t}
                    href={t === 'AI Generate' ? '/new?tab=post' : '/new'}
                    className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-bold text-soft transition hover:border-ink hover:text-ink"
                  >
                    {t}
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Link href="/new" className="btn btn-ghost !py-1.5 !text-xs">
                  Schedule
                </Link>
                <Link href="/new" className="btn btn-primary !py-1.5 !text-xs">
                  Post
                </Link>
              </div>
            </section>

            <section className="card flex flex-col justify-between p-5" aria-label="AI generation">
              <div>
                <span className="pill w-fit bg-accent-soft text-accent-ink">AI</span>
                <p className="mt-3 font-display text-lg font-extrabold leading-snug tracking-tight">
                  Turn ideas into engaging posts.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Draft with research-backed copy, find inspiration, and adapt one idea across every channel.
                </p>
              </div>
              {/* Picture area: filled in later. */}
              <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">
                <ThumbSlot className="aspect-square" />
                <ThumbSlot className="aspect-square" />
                <ThumbSlot className="aspect-square" />
              </div>
              <Link href="/new?tab=post" className="btn btn-bolt mt-4 w-full !text-xs">
                Try AI Generation
              </Link>
            </section>
          </div>

          {/* Week calendar */}
          <section className="card p-5" aria-label="Content calendar">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Content Calendar</p>
              <Link href="/calendar" className="text-xs font-bold text-ink hover:underline">
                Open calendar
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {week.map(({ d, k, posts: dayPosts, isToday }) => (
                <Link
                  key={k}
                  href="/calendar"
                  className={`flex min-h-[110px] flex-col rounded-xl border p-2 text-left transition hover:border-ink ${
                    isToday ? 'border-accent bg-accent-soft/50' : 'border-line bg-paper'
                  }`}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-faint">
                    {WEEKDAYS[(d.getDay() + 6) % 7]?.slice(0, 3) ?? ''}
                  </span>
                  <span
                    className={`mt-0.5 font-display text-sm font-extrabold ${isToday ? 'text-accent-ink' : ''}`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="mt-1.5 flex flex-col gap-1 overflow-hidden">
                    {dayPosts.slice(0, 2).map((p) => {
                      const pv = p.post_targets?.[0]?.provider;
                      const meta = pv ? providerMeta(pv) : null;
                      return (
                        <span
                          key={p.id}
                          className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                          style={
                            meta
                              ? { background: `${meta.color}14`, color: meta.color }
                              : undefined
                          }
                        >
                          {meta?.glyph ?? '·'} {fmtTime(p.scheduled_at)}
                        </span>
                      );
                    })}
                    {dayPosts.length > 2 ? (
                      <span className="text-[10px] font-bold text-muted">+{dayPosts.length - 2} more</span>
                    ) : null}
                    {dayPosts.length === 0 ? (
                      <span className="text-[10px] font-medium text-faint">-</span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
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
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recent.map((p) => {
                  const pv = (p.post_targets?.[0]?.provider ?? 'instagram') as ProviderKey;
                  const meta = providerMeta(pv);
                  const failed = p.status === 'failed';
                  return (
                    <li key={p.id} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-dim ring-1 ring-line"
                        title={meta.label}
                      >
                        <BrandIcon provider={pv} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">
                          {failed ? 'Failed: ' : 'Sent: '}
                          {p.title || 'Untitled post'}
                        </span>
                        <span className="block text-[11px] text-faint">{timeAgo(p.sent_at)}</span>
                      </span>
                      <span
                        className={`pill ml-auto shrink-0 text-[10px] ${POST_STATUS_META[p.status].className}`}
                      >
                        {POST_STATUS_META[p.status].label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
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
              <div className="mt-4 flex flex-col items-start gap-2">
                <p className="text-sm text-muted">Nothing scheduled right now.</p>
                <Link href="/new" className="btn btn-bolt !py-1.5 !text-xs">
                  Compose
                </Link>
              </div>
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
                          <BrandIcon provider={pv} className="h-3.5 w-3.5 shrink-0" />
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
          <section className="card p-5" aria-label="Analytics overview">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Analytics Overview</p>
              <Link href="/analytics" className="text-xs font-bold text-ink hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {['7D', '30D', '90D'].map((t, i) => (
                <span
                  key={t}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold ${
                    i === 0 ? 'bg-accent-soft text-accent-ink' : 'bg-paper-dim text-muted'
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
            {/* Simple sent-per-day bars for the current week. */}
            <div className="mt-4 flex h-28 items-end gap-1.5" aria-hidden="true">
              {week.map(({ k, isToday }) => {
                const count = posts.filter(
                  (p) =>
                    (p.status === 'sent' || p.status === 'partial') &&
                    p.sent_at &&
                    dayKey(new Date(p.sent_at)) === k,
                ).length;
                const h = count === 0 ? 8 : Math.min(100, 20 + count * 20);
                return (
                  <div key={k} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-md ${isToday ? 'bg-accent' : 'bg-ink/80'}`}
                      style={{ height: `${h}%` }}
                      title={`${count} sent`}
                    />
                    <span className="text-[9px] font-bold text-faint">{k.slice(8)}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-faint">Posts sent per day this week.</p>
          </section>

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
