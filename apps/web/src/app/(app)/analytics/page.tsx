import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, Clock, Link2, Send } from 'lucide-react';
import BarChartPanel from '@/components/analytics/BarChartPanel';
import { BrandIcon } from '@/components/BrandIcon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HBarList } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { fetchChannels, fetchPostsLite } from '@/lib/posts';
import type { ProviderKey } from '@/lib/types';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DAY = 24 * 3600_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmtDate = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ACTIVE_TARGET = new Set(['pending', 'needs_approval', 'queued', 'publishing']);

/** Full analytics: pipeline funnel, per-channel delivery, weekly rhythm, recent sends. */
export default async function AnalyticsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);

  const now = Date.now();
  const byStatus = (s: string[]) => posts.filter((p) => s.includes(p.status));
  const drafts = byStatus(['draft']).length;
  const queued = byStatus(['queued', 'publishing', 'approval']).length;
  const sent = byStatus(['sent', 'partial']);
  const failed = byStatus(['failed']).length;
  const sentWeek = sent.filter((p) => p.sent_at && now - new Date(p.sent_at).getTime() < 7 * DAY).length;
  const liveChannels = channels.filter((c) => c.status === 'connected').length;
  const funnelMax = Math.max(1, drafts, queued, sent.length, failed);

  // Per-channel delivery across every target ever recorded.
  const perChannel = new Map<ProviderKey, { sent: number; active: number; failed: number }>();
  for (const p of posts) {
    for (const t of p.post_targets ?? []) {
      const row = perChannel.get(t.provider) ?? { sent: 0, active: 0, failed: 0 };
      if (t.status === 'sent') row.sent += 1;
      else if (t.status === 'failed' || t.status === 'skipped') row.failed += 1;
      else if (ACTIVE_TARGET.has(t.status)) row.active += 1;
      perChannel.set(t.provider, row);
    }
  }
  const channelRows = [...perChannel.entries()]
    .map(([provider, r]) => ({ provider, ...r, total: r.sent + r.active + r.failed }))
    .sort((a, b) => b.sent - a.sent || b.total - a.total);

  // Weekly rhythm: sent posts per week, last 8 weeks.
  const weeks: { label: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * DAY;
    const end = now - i * 7 * DAY;
    const count = sent.filter((p) => {
      if (!p.sent_at) return false;
      const t = new Date(p.sent_at).getTime();
      return t >= start && t < end;
    }).length;
    weeks.push({
      label: new Date(end).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      count,
    });
  }
  const weekMax = Math.max(1, ...weeks.map((w) => w.count));

  // Weekday rhythm: sent posts by day-of-week.
  const weekdayCounts = new Array(7).fill(0);
  for (const p of sent) {
    if (!p.sent_at) continue;
    const d = new Date(p.sent_at);
    if (Number.isNaN(d.getTime())) continue;
    weekdayCounts[d.getDay()] += 1;
  }
  const weekdayData = WEEKDAYS.map((label, i) => ({ label, count: weekdayCounts[i] }));
  const weekdayMax = Math.max(1, ...weekdayCounts);

  const recent = [...sent]
    .filter((p) => p.sent_at)
    .sort((a, b) => +new Date(b.sent_at!) - +new Date(a.sent_at!))
    .slice(0, 8);

  const funnel: { label: string; value: number; href: string; color: string }[] = [
    { label: 'Drafts', value: drafts, href: '/queue', color: 'var(--color-surface)' },
    { label: 'Queued', value: queued, href: '/calendar', color: 'var(--color-bolt)' },
    { label: 'Sent', value: sent.length, href: '/queue', color: 'var(--color-ink)' },
    { label: 'Failed', value: failed, href: '/queue', color: '#E60023' },
  ];

  const stats = [
    { label: 'Posts sent', value: sent.length, href: '/queue', icon: Send },
    { label: 'Sent this week', value: sentWeek, href: '/queue', icon: CalendarClock },
    { label: 'Scheduled', value: queued, href: '/calendar', icon: Clock },
    { label: 'Channels live', value: `${liveChannels}/${channels.length}`, href: '/channels', icon: Link2 },
  ];

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Analytics</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        How you&apos;re doing
      </h1>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="group p-4 transition hover:border-ink sm:p-5">
              <s.icon className="h-5 w-5 text-muted transition group-hover:text-ink" aria-hidden="true" />
              <p className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList
              rows={funnel.map((f) => ({
                key: f.label,
                value: f.value,
                max: funnelMax,
                color: f.color,
                label: (
                  <Link href={f.href} className="font-bold hover:text-ink">
                    {f.label}
                  </Link>
                ),
              }))}
            />
          </CardContent>
        </Card>

        {/* Weekly rhythm */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sends per week · last 8 weeks</CardTitle>
              <CardDescription>best: {weekMax}/wk</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BarChartPanel data={weeks} dataKey="count" labelKey="label" domainMax={weekMax} height={176} suffix="sent" />
          </CardContent>
        </Card>

        {/* Weekday rhythm */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sends by weekday</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartPanel
              data={weekdayData}
              dataKey="count"
              labelKey="label"
              domainMax={weekdayMax}
              height={176}
              suffix="sent"
            />
          </CardContent>
        </Card>

        {/* Recently sent */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recently sent</CardTitle>
              <Link href="/queue" className="text-xs font-bold text-ink hover:underline">
                Queue
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No sends yet.</p>
            ) : (
              <ul className="space-y-3">
                {recent.slice(0, 5).map((p) => {
                  const providers = [...new Set((p.post_targets ?? []).map((t) => t.provider))];
                  const st = POST_STATUS_META[p.status];
                  return (
                    <li key={p.id} className="flex items-center gap-2.5">
                      <div className="flex shrink-0 items-center" aria-hidden="true">
                        {providers.slice(0, 3).map((pv, i) => (
                          <span
                            key={pv}
                            className="rounded-full ring-2 ring-card"
                            style={{ marginLeft: i === 0 ? 0 : -7, zIndex: providers.length - i }}
                            title={providerMeta(pv).label}
                          >
                            <BrandIcon provider={pv} className="h-6 w-6" />
                          </span>
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p.title || 'Untitled post'}</p>
                        <p className="text-xs text-muted">{fmtDate(p.sent_at)}</p>
                      </div>
                      <Badge className={st.className}>{st.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Per-channel delivery */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Delivery by channel</CardTitle>
              <Link href="/channels" className="text-xs font-bold text-ink hover:underline">
                Manage
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {channelRows.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing published yet. Your per-channel numbers land here after the first send.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="w-40">Success</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelRows.map((r) => {
                    const meta = providerMeta(r.provider);
                    const ok = Math.round((r.sent / Math.max(1, r.total)) * 100);
                    return (
                      <TableRow key={r.provider}>
                        <TableCell>
                          <span className="flex items-center gap-2.5">
                            <BrandIcon provider={r.provider} className="h-7 w-7 shrink-0" />
                            <span className="truncate font-bold">{meta.label}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-display font-extrabold">{r.sent}</TableCell>
                        <TableCell className="text-right text-muted">{r.active}</TableCell>
                        <TableCell className="text-right text-muted">{r.failed}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                              <span
                                className="block h-full rounded-full bg-[#2f8f5b]"
                                style={{ width: `${ok}%` }}
                              />
                            </span>
                            <span className="w-9 shrink-0 text-right text-xs font-bold text-muted">{ok}%</span>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Likes, comments and reach per post arrive with the stats pipeline.</p>
        <Link href="/post" className="btn btn-bolt shrink-0">
          Create a post
        </Link>
      </Card>
    </div>
  );
}
