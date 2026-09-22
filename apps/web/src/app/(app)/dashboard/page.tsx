import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import { ChannelStack } from '@/components/ui';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { fetchChannels, fetchPostsLite } from '@/lib/posts';
import type { ProviderKey } from '@/lib/types';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const fmtWhen = (iso: string | null): string => {
  if (!iso) return 'Unscheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unscheduled';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const todayLabel = (): string =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/** Monday 00:00 of the current week — the week board's anchor. */
const weekStart = (): Date => {
  const x = new Date();
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
};

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Postiz-style week board: the current week as seven columns of compact post cards. */
function WeekBoard({ posts }: { posts: Awaited<ReturnType<typeof fetchPostsLite>> }) {
  const start = weekStart();
  const now = new Date();
  const inWeek = posts
    .filter((p) => {
      if (!p.scheduled_at) return false;
      const t = new Date(p.scheduled_at);
      return t >= start && t < new Date(start.getTime() + 7 * 86_400_000);
    })
    .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!));

  return (
    <section className="card p-4" aria-label="This week">
      <div className="flex items-center justify-between">
        <p className="eyebrow">This week</p>
        <Link href="/calendar" className="text-xs font-bold text-ink hover:underline">
          Full calendar
        </Link>
      </div>
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="grid min-w-[672px] grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(start);
            day.setDate(day.getDate() + i);
            const isToday = sameDay(day, now);
            const items = inWeek.filter((p) => sameDay(new Date(p.scheduled_at!), day));
            return (
              <div key={day.toISOString()} className="min-w-0">
                <p
                  className={`mb-1.5 flex items-center justify-center gap-1.5 rounded-[10px] px-1 py-1 text-center text-[11px] font-bold ${
                    isToday ? 'bg-bolt text-ink' : 'bg-surface text-muted'
                  }`}
                >
                  {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getDate()}
                </p>
                <div className="space-y-1.5">
                  {items.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-line px-1.5 py-2 text-center text-[10px] text-faint">
                      —
                    </p>
                  ) : (
                    items.map((p) => {
                      const providers = [...new Set((p.post_targets ?? []).map((t) => t.provider))];
                      const t = new Date(p.scheduled_at!);
                      return (
                        <div
                          key={p.id}
                          className="rounded-[10px] border border-line bg-paper px-2 py-1.5"
                          title={p.title || 'Untitled post'}
                        >
                          <p className="text-[10px] font-bold text-muted">
                            {t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-semibold">
                            {p.title || 'Untitled post'}
                          </p>
                          <p className="mt-1 flex gap-1" aria-label="Channels">
                            {providers.slice(0, 5).map((pv) => (
                              <span
                                key={pv}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: providerMeta(pv).color }}
                                title={providerMeta(pv).label}
                              />
                            ))}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link href={href} className="card group p-4 transition hover:border-ink sm:p-5">
      <p className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted">
        {label}
      </p>
    </Link>
  );
}

/** Everything-at-a-glance home: stats, what's next, what needs you, channels. */
export default async function DashboardPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);

  const now = Date.now();
  const queued = posts.filter((p) => p.status === 'queued' || p.status === 'publishing');
  const upcoming = queued
    .filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() >= now - 60_000)
    .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!))
    .slice(0, 4);
  const drafts = posts.filter((p) => p.status === 'draft');
  const approvals = posts.filter((p) => p.status === 'approval');
  const failed = posts.filter((p) => p.status === 'failed');
  const sentWeek = posts.filter(
    (p) =>
      (p.status === 'sent' || p.status === 'partial') &&
      p.sent_at &&
      now - new Date(p.sent_at).getTime() < 7 * 24 * 3600_000,
  );
  const live = channels.filter((c) => c.status === 'connected');
  const sick = channels.filter((c) => c.status !== 'connected');
  const attentionCount = failed.length + approvals.length + sick.length;

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting()}, {ctx.workspace.name}
          </h1>
        </div>
        <Link href="/new" className="btn btn-bolt">
          + New post
        </Link>
      </div>

      <div className="mt-5">
        <WeekBoard posts={posts} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Scheduled" value={queued.length} href="/calendar" />
        <Stat label="Sent this week" value={sentWeek.length} href="/queue" />
        <Stat label="Drafts" value={drafts.length} href="/queue" />
        <Stat label="Channels live" value={live.length > 0 ? `${live.length}/${channels.length}` : '0'} href="/channels" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Up next — the hero tile */}
        <section className="card p-5 lg:col-span-2 lg:row-span-2" aria-label="Up next">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Up next</p>
            <Link href="/calendar" className="text-xs font-bold text-ink hover:underline">
              Full calendar
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <p className="font-display text-base font-extrabold">Nothing scheduled</p>
              <p className="max-w-xs text-sm text-muted">Queue something and it will show up here first.</p>
              <Link href="/new" className="btn btn-bolt mt-2">
                Compose
              </Link>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft">
              {upcoming.map((p) => {
                const providers = [...new Set((p.post_targets ?? []).map((t) => t.provider))];
                const st = POST_STATUS_META[p.status];
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.title || 'Untitled post'}</p>
                      <p className="mt-0.5 text-xs text-muted">{fmtWhen(p.scheduled_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center" aria-label="Channels">
                      <ChannelStack providers={providers as ProviderKey[]} />
                    </div>
                    <span className={`pill shrink-0 ${st.className}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Needs attention */}
        <section className="card p-5" aria-label="Needs attention">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Needs attention</p>
            {attentionCount > 0 ? (
              <span className="pill bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                {attentionCount}
              </span>
            ) : null}
          </div>
          {attentionCount === 0 ? (
            <p className="mt-3 text-sm text-muted">All clear. Nothing failed, waiting, or expired.</p>
          ) : (
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
                  <BrandIcon provider={c.provider} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-bold">{providerMeta(c.provider).label}</span>
                  <span className="text-xs text-muted">{c.status}. Reconnect in the app.</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Channels */}
        <section className="card p-5" aria-label="Channels">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Channels</p>
            <Link href="/channels" className="text-xs font-bold text-ink hover:underline">
              Manage
            </Link>
          </div>
          {channels.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing connected yet. Connect accounts in the mobile app.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {channels.slice(0, 5).map((c) => {
                const meta = providerMeta(c.provider);
                const ok = c.status === 'connected';
                return (
                  <li key={c.id} className="flex items-center gap-2.5">
                    <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {c.handle ? `@${c.handle}` : (c.display_name ?? meta.label)}
                    </span>
                    <span
                      aria-hidden="true"
                      title={c.status}
                      className={`h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-[#2f8f5b]' : 'bg-[#E60023]'}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {channels.length > 5 ? (
            <p className="mt-2 text-xs text-muted">+{channels.length - 5} more in Channels.</p>
          ) : null}
        </section>

        {/* Quick actions */}
        <section className="card flex flex-col justify-between gap-3 bg-ink p-5 text-paper lg:col-span-3 lg:flex-row lg:items-center" aria-label="Quick actions">
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">Ship today&apos;s posts</p>
            <p className="mt-1 text-sm text-paper/80">Compose, check the queue, or review the week.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/new" className="btn btn-bolt font-bold">
              Compose
            </Link>
            <Link
              href="/queue"
              className="btn border border-paper/30 font-bold text-paper hover:bg-paper/10"
            >
              Queue
            </Link>
            <Link
              href="/calendar"
              className="btn border border-paper/30 font-bold text-paper hover:bg-paper/10"
            >
              Calendar
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
