'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpDown, CalendarDays, Download, Eye, FileDown, FileText, Heart, Info, MessageCircle, Percent, Send, Users } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { BrandIcon } from '@/components/BrandIcon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Drawer } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { HBarList } from '@/components/ui/chart';
import BarChartPanel from '@/components/analytics/BarChartPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import type { ConnectedChannel, PostStatus, PostWithTargets, ProviderKey } from '@/lib/types';

export interface StatSnapshotRow {
  post_id: string;
  channel_id: string;
  provider: string;
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
}

export interface FollowerSnapshotRow {
  channel_id: string;
  provider: string;
  followers: number | null;
  fetched_at: string;
}

type RangePreset = 'last7' | 'last30' | 'mtd' | 'custom';
type TopSortKey = 'interactions' | 'sent_at';

const DAY = 24 * 3600_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ACTIVE_TARGET = new Set(['pending', 'needs_approval', 'queued', 'publishing']);

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'last7', label: '7 days' },
  { id: 'last30', label: '30 days' },
  { id: 'mtd', label: 'Month to date' },
  { id: 'custom', label: 'Custom' },
];

const fmtDate = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const full = (n: number | null): string => (n === null ? '—' : n.toLocaleString('en-US'));

const startOfDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const csvCell = (v: string | number | null): string => {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(name: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

interface TopPost {
  id: string;
  title: string;
  sentAt: string | null;
  providers: ProviderKey[];
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
  interactions: number;
}

export default function AnalyticsDashboard({
  posts,
  channels,
  postStats,
  channelStats,
}: {
  posts: PostWithTargets[];
  channels: ConnectedChannel[];
  postStats: StatSnapshotRow[];
  channelStats: FollowerSnapshotRow[];
}) {
  const now = Date.now();
  const [preset, setPreset] = useState<RangePreset>('last30');
  const [custom, setCustom] = useState<DateRange | undefined>();
  const [calOpen, setCalOpen] = useState(false);
  const [chanSel, setChanSel] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [topSort, setTopSort] = useState<{ key: TopSortKey; dir: 'asc' | 'desc' }>({
    key: 'interactions',
    dir: 'desc',
  });

  const range = useMemo((): { from: number; to: number; label: string } => {
    const sod = startOfDay(now);
    if (preset === 'last7') return { from: sod - 6 * DAY, to: sod + DAY - 1, label: 'Last 7 days' };
    if (preset === 'last30') return { from: sod - 29 * DAY, to: sod + DAY - 1, label: 'Last 30 days' };
    if (preset === 'mtd') {
      const d = new Date(now);
      return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: sod + DAY - 1, label: 'Month to date' };
    }
    const from = custom?.from ? startOfDay(custom.from.getTime()) : sod - 29 * DAY;
    const to = custom?.to ? startOfDay(custom.to.getTime()) + DAY - 1 : sod + DAY - 1;
    const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
  }, [preset, custom, now]);

  /** Connected channels on the account (filter chips). */
  const connectedChannels = useMemo(
    () => channels.filter((c) => c.status === 'connected'),
    [channels],
  );
  const providersPresent = useMemo(() => {
    const set = new Set<ProviderKey>();
    for (const c of connectedChannels) set.add(c.provider);
    return [...set].sort((a, b) => providerMeta(a).label.localeCompare(providerMeta(b).label));
  }, [connectedChannels]);

  const inRange = (iso: string | null | undefined): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= range.from && t <= range.to;
  };
  const postDate = (p: PostWithTargets): string | null => p.sent_at ?? p.scheduled_at ?? p.created_at ?? null;
  const postInScope = (p: PostWithTargets): boolean => {
    if (!inRange(postDate(p))) return false;
    if (chanSel.length === 0) return true;
    return (p.post_targets ?? []).some((t) => chanSel.includes(t.provider));
  };

  const scoped = useMemo(() => posts.filter(postInScope), [posts, range, chanSel]);
  const byStatus = (s: string[]) => scoped.filter((p) => s.includes(p.status));
  const drafts = byStatus(['draft']).length;
  const queued = byStatus(['queued', 'publishing', 'approval']).length;
  const sent = byStatus(['sent', 'partial']);
  const failed = byStatus(['failed']).length;
  const funnelMax = Math.max(1, drafts, queued, sent.length, failed);

  // ---- engagement aggregates (latest snapshots; not date-bound) ----
  const chanOk = (provider: string): boolean => chanSel.length === 0 || chanSel.includes(provider);
  const statsScoped = useMemo(
    () => postStats.filter((r) => chanOk(r.provider)),
    [postStats, chanSel],
  );
  const likes = statsScoped.reduce((a, r) => a + (r.likes ?? 0), 0);
  const comments = statsScoped.reduce((a, r) => a + (r.comments ?? 0), 0);
  const shares = statsScoped.reduce((a, r) => a + (r.shares ?? 0), 0);
  const views = statsScoped.reduce((a, r) => a + (r.views == null ? 0 : Number(r.views)), 0);
  const hasViews = statsScoped.some((r) => r.views != null);
  const chanStatsScoped = useMemo(
    () => channelStats.filter((r) => chanOk(r.provider)),
    [channelStats, chanSel],
  );
  const followers = chanStatsScoped.reduce((a, r) => a + (r.followers ?? 0), 0);
  const hasFollowers = chanStatsScoped.some((r) => r.followers !== null);
  const eng =
    hasFollowers && followers > 0 ? `${(((likes + comments + shares) / followers) * 100).toFixed(1)}%` : null;

  const funnel: { label: string; value: number; href: string; color: string }[] = [
    { label: 'Drafts', value: drafts, href: '/queue', color: 'var(--color-surface)' },
    { label: 'Queued', value: queued, href: '/calendar', color: 'var(--color-bolt)' },
    { label: 'Sent', value: sent.length, href: '/queue', color: 'var(--color-ink)' },
    { label: 'Failed', value: failed, href: '/queue', color: '#E60023' },
  ];

  // Stat cards are display-only (not links) — the ⓘ explains each number.
  const stats: { label: string; value: string; icon: typeof Send; hint: string }[] = [
    { label: 'Posts', value: full(sent.length), icon: Send, hint: `Posts sent in ${range.label.toLowerCase()}.` },
    {
      label: 'Total Followers',
      value: hasFollowers ? full(followers) : '—',
      icon: Users,
      hint: 'Latest follower total across the selected channels. Snapshots refresh daily — never rounded.',
    },
    {
      label: 'Reactions',
      value: full(likes),
      icon: Heart,
      hint: 'Latest like totals across sent posts on the selected channels.',
    },
    {
      label: 'Comments',
      value: full(comments),
      icon: MessageCircle,
      hint: 'Latest comment totals across sent posts on the selected channels.',
    },
    {
      label: 'Eng. Rate',
      value: eng ?? '—',
      icon: Percent,
      hint: '(Reactions + Comments + Shares) ÷ Followers, from the latest snapshots.',
    },
    {
      label: 'Views',
      value: hasViews ? full(views) : '—',
      icon: Eye,
      hint: 'Latest view totals where the platform exposes them (— where it does not).',
    },
  ];

  // ---- per-channel delivery (range + channel scoped) ----
  const perChannel = new Map<ProviderKey, { sent: number; active: number; failed: number }>();
  for (const p of scoped) {
    for (const t of p.post_targets ?? []) {
      if (chanSel.length > 0 && !chanSel.includes(t.provider)) continue;
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

  // ---- weekly + weekday rhythm (range scoped) ----
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

  // ---- top posts: interactions summed across the post's targets ----
  const statsByPost = useMemo(() => {
    const map = new Map<string, { likes: number; comments: number; shares: number; views: number | null }>();
    for (const r of statsScoped) {
      if (!r.post_id) continue;
      const cur = map.get(r.post_id) ?? { likes: 0, comments: 0, shares: 0, views: null };
      cur.likes += r.likes ?? 0;
      cur.comments += r.comments ?? 0;
      cur.shares += r.shares ?? 0;
      if (r.views != null) cur.views = (cur.views ?? 0) + Number(r.views);
      map.set(r.post_id, cur);
    }
    return map;
  }, [statsScoped]);

  const topPosts: TopPost[] = useMemo(() => {
    const rows: TopPost[] = [];
    for (const p of sent) {
      const agg = statsByPost.get(p.id);
      const likes = agg?.likes ?? 0;
      const cm = agg?.comments ?? 0;
      const sh = agg?.shares ?? 0;
      const providers = [...new Set((p.post_targets ?? []).map((t) => t.provider))];
      rows.push({
        id: p.id,
        title: p.title || p.body?.slice(0, 60) || 'Untitled post',
        sentAt: p.sent_at,
        providers,
        likes,
        comments: cm,
        shares: sh,
        views: agg?.views ?? null,
        interactions: likes + cm + sh,
      });
    }
    const dir = topSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) =>
      topSort.key === 'interactions'
        ? (a.interactions - b.interactions) * dir
        : (new Date(a.sentAt ?? 0).getTime() - new Date(b.sentAt ?? 0).getTime()) * dir,
    );
    return rows.slice(0, 5);
  }, [sent, statsByPost, topSort]);

  // ---- channel performance table (latest snapshots, channel-filtered) ----
  const totalsBy = new Map<string, { likes: number; comments: number; shares: number; views: number | null }>();
  for (const r of statsScoped) {
    const cur = totalsBy.get(r.channel_id) ?? { likes: 0, comments: 0, shares: 0, views: null };
    cur.likes += r.likes ?? 0;
    cur.comments += r.comments ?? 0;
    cur.shares += r.shares ?? 0;
    if (r.views != null) cur.views = (cur.views ?? 0) + Number(r.views);
    totalsBy.set(r.channel_id, cur);
  }
  const perfRows = channels
    .filter((c) => c.status === 'connected' || c.status === 'expired')
    .filter((c) => chanSel.length === 0 || chanSel.includes(c.provider))
    .map((c) => {
      const tot = totalsBy.get(c.id);
      const snap = chanStatsScoped.find((s) => s.channel_id === c.id);
      const fol = snap?.followers ?? null;
      const sn = sent.filter((p) => (p.post_targets ?? []).some((t) => t.channel_id === c.id && t.status === 'sent')).length;
      return {
        channelId: c.id,
        provider: c.provider,
        label: providerMeta(c.provider).label,
        followers: fol,
        likes: tot?.likes ?? 0,
        comments: tot?.comments ?? 0,
        shares: tot?.shares ?? 0,
        views: tot?.views ?? null,
        sent: sn,
        fetchedAt: snap?.fetched_at ?? null,
      };
    })
    .filter((r) => r.sent > 0 || r.followers !== null);
  const chanEng = (r: { likes: number; comments: number; shares: number; followers: number | null }): string | null =>
    r.followers && r.followers > 0 ? `${(((r.likes + r.comments + r.shares) / r.followers) * 100).toFixed(1)}%` : null;

  // ---- exports ----
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = (): void => {
    const lines = [
      `Sosial analytics,${range.label},exported ${stamp}`,
      '',
      'Channel,Followers,Likes,Comments,Shares,Views,Engagement,Sent',
      ...perfRows.map((r) =>
        [
          csvCell(r.label),
          r.followers ?? '',
          r.likes,
          r.comments,
          r.shares,
          r.views ?? '',
          chanEng(r) ?? '',
          r.sent,
        ].join(','),
      ),
      '',
      'Top posts,Sent,Channels,Likes,Comments,Shares,Views,Interactions',
      ...topPosts.map((p) =>
        [
          csvCell(p.title),
          p.sentAt ? new Date(p.sentAt).toISOString().slice(0, 10) : '',
          csvCell(p.providers.map((pv) => providerMeta(pv).label).join(' + ')),
          p.likes,
          p.comments,
          p.shares,
          p.views ?? '',
          p.interactions,
        ].join(','),
      ),
    ];
    download(`sosial-analytics-${stamp}.csv`, 'text/csv', lines.join('\n'));
  };

  const exportMarkdown = (): void => {
    const md = [
      `# Sosial analytics — ${range.label}`,
      `Exported ${stamp}`,
      '',
      `**Posts:** ${sent.length} · **Followers:** ${hasFollowers ? followers.toLocaleString('en-US') : '—'} · **Reactions:** ${likes.toLocaleString('en-US')} · **Comments:** ${comments.toLocaleString('en-US')} · **Eng. rate:** ${eng ?? '—'} · **Views:** ${hasViews ? views.toLocaleString('en-US') : '—'}`,
      '',
      '## Channels',
      '',
      '| Channel | Followers | Likes | Comments | Shares | Views | Engagement | Sent |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...perfRows.map(
        (r) =>
          `| ${r.label} | ${r.followers ?? '—'} | ${r.likes} | ${r.comments} | ${r.shares} | ${r.views ?? '—'} | ${chanEng(r) ?? '—'} | ${r.sent} |`,
      ),
      '',
      '## Top posts',
      '',
      '| Post | Sent | Channels | Likes | Comments | Shares | Views | Interactions |',
      '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
      ...topPosts.map(
        (p) =>
          `| ${p.title.replace(/\|/g, '\\|').slice(0, 80)} | ${p.sentAt ? new Date(p.sentAt).toISOString().slice(0, 10) : '—'} | ${p.providers.map((pv) => providerMeta(pv).label).join(' + ')} | ${p.likes} | ${p.comments} | ${p.shares} | ${p.views ?? '—'} | ${p.interactions} |`,
      ),
      '',
    ];
    download(`sosial-analytics-${stamp}.md`, 'text/markdown', md.join('\n'));
  };

  const exportPdf = (): void => {
    const row = (cells: string[]): string =>
      `<tr>${cells.map((c, i) => `<td style="padding:7px 10px;border-bottom:1px solid #eee;${i > 0 ? 'text-align:right;' : ''}font-size:12px;">${c}</td>`).join('')}</tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sosial analytics — ${range.label}</title></head><body style="font-family:system-ui,sans-serif;color:#1C1A14;max-width:900px;margin:32px auto;padding:0 24px;">
<h1 style="font-size:22px;">Sosial analytics — ${range.label}</h1>
<p style="color:#666;font-size:12px;">Exported ${stamp}${chanSel.length ? ` · Channels: ${chanSel.map((p) => providerMeta(p).label).join(', ')}` : ''}</p>
<p style="font-size:13px;"><b>Posts:</b> ${sent.length} · <b>Followers:</b> ${hasFollowers ? followers.toLocaleString('en-US') : '—'} · <b>Reactions:</b> ${likes.toLocaleString('en-US')} · <b>Comments:</b> ${comments.toLocaleString('en-US')} · <b>Eng. rate:</b> ${eng ?? '—'} · <b>Views:</b> ${hasViews ? views.toLocaleString('en-US') : '—'}</p>
<h2 style="font-size:16px;margin-top:28px;">Channels</h2>
<table style="border-collapse:collapse;width:100%;"><thead><tr>${['Channel', 'Followers', 'Likes', 'Comments', 'Shares', 'Views', 'Engagement', 'Sent'].map((h, i) => `<th style="text-align:${i === 0 ? 'left' : 'right'};padding:7px 10px;border-bottom:2px solid #1C1A14;font-size:12px;">${h}</th>`).join('')}</tr></thead><tbody>
${perfRows.map((r) => row([r.label, r.followers === null ? '—' : String(r.followers), String(r.likes), String(r.comments), String(r.shares), r.views === null ? '—' : String(r.views), chanEng(r) ?? '—', String(r.sent)])).join('')}
</tbody></table>
<h2 style="font-size:16px;margin-top:28px;">Top posts</h2>
<table style="border-collapse:collapse;width:100%;"><thead><tr>${['Post', 'Sent', 'Channels', 'Likes', 'Comments', 'Shares', 'Views', 'Interactions'].map((h, i) => `<th style="text-align:${i < 3 ? 'left' : 'right'};padding:7px 10px;border-bottom:2px solid #1C1A14;font-size:12px;">${h}</th>`).join('')}</tr></thead><tbody>
${topPosts.map((p) => `<tr>${[p.title.slice(0, 90), p.sentAt ? new Date(p.sentAt).toISOString().slice(0, 10) : '—', p.providers.map((pv) => providerMeta(pv).label).join(' + ')].map((c) => `<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;">${c}</td>`).join('')}${[p.likes, p.comments, p.shares, p.views ?? '—', p.interactions].map((c) => `<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right;">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table>
<p style="color:#666;font-size:11px;margin-top:24px;">Engagement = (likes + comments + shares) ÷ followers. Follower and engagement figures are the latest daily snapshots.</p>
</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const toggleChan = (p: string): void =>
    setChanSel((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const flipSort = (key: TopSortKey): void =>
    setTopSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    );

  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            How you&apos;re doing
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="btn btn-sm btn-bolt"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export
        </button>
      </div>

      {/* Range + channel controls */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {PRESETS.filter((p) => p.id !== 'custom').map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset === p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              preset === p.id ? 'border-accent bg-accent text-ink' : 'border-line bg-card text-muted hover:bg-paper'
            }`}
          >
            {p.label}
          </button>
        ))}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-pressed={preset === 'custom'}
              onClick={() => setPreset('custom')}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${
                preset === 'custom' ? 'border-accent bg-accent text-ink' : 'border-line bg-card text-muted hover:bg-paper'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {preset === 'custom' && custom?.from ? range.label : 'Custom'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={custom?.from}
              selected={custom}
              onSelect={setCustom}
              numberOfMonths={1}
            />
            <div className="flex items-center justify-between gap-2 border-t border-line-soft p-3">
              <button
                type="button"
                onClick={() => setCustom(undefined)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-muted transition hover:text-ink"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreset('custom');
                  setCalOpen(false);
                }}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-ink transition hover:bg-accent-bright"
              >
                Apply
              </button>
            </div>
          </PopoverContent>
        </Popover>
        {preset !== 'custom' ? <span className="ml-1 text-xs text-faint">{range.label}</span> : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Filter by channel">
        <button
          type="button"
          aria-pressed={chanSel.length === 0}
          onClick={() => setChanSel([])}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            chanSel.length === 0 ? 'border-accent bg-accent text-ink' : 'border-line bg-card text-muted hover:bg-paper'
          }`}
        >
          All channels
        </button>
        {providersPresent.map((p) => {
          const on = chanSel.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => toggleChan(p)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                on ? 'border-accent bg-accent text-ink' : 'border-line bg-card text-muted hover:bg-paper'
              }`}
            >
              <BrandIcon provider={p} className="h-4 w-4" />
              {providerMeta(p).label}
            </button>
          );
        })}
      </div>

      {/* Stat cards: display-only, ⓘ explains each number */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-muted" aria-hidden="true" />
              <Tooltip content={s.hint} align="end">
                <button
                  type="button"
                  aria-label={s.hint}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-faint transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Top posts */}
      <Card className="mt-3">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Top posts</CardTitle>
              <CardDescription>Ranked by interactions in {range.label.toLowerCase()}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          {topPosts.length === 0 ? (
            <p className="text-sm text-muted">No sent posts in this range yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead className="text-right">
                    <button type="button" onClick={() => flipSort('sent_at')} className="inline-flex items-center gap-1 font-bold hover:text-ink" aria-label="Sort by date">
                      Sent
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">
                    <button type="button" onClick={() => flipSort('interactions')} className="inline-flex items-center gap-1 font-bold hover:text-ink" aria-label="Sort by interactions">
                      Interactions
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPosts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-56">
                      <span className="block truncate font-bold" title={p.title}>{p.title}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center">
                        {p.providers.slice(0, 4).map((pv, i) => (
                          <span key={pv} className="rounded-full ring-2 ring-card" style={{ marginLeft: i === 0 ? 0 : -7, zIndex: p.providers.length - i }} title={providerMeta(pv).label}>
                            <BrandIcon provider={pv} className="h-6 w-6" />
                          </span>
                        ))}
                        {p.providers.length > 4 ? <span className="ml-1 text-[11px] text-muted">+{p.providers.length - 4}</span> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted">{fmtDate(p.sentAt)}</TableCell>
                    <TableCell className="text-right text-muted">{full(p.likes)}</TableCell>
                    <TableCell className="text-right text-muted">{full(p.comments)}</TableCell>
                    <TableCell className="text-right text-muted">{full(p.shares)}</TableCell>
                    <TableCell className="text-right text-muted">{p.views === null ? '—' : full(p.views)}</TableCell>
                    <TableCell className="text-right font-display font-extrabold">{full(p.interactions)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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

        {/* Channel performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Channel performance</CardTitle>
                <CardDescription>Followers refresh daily · engagement is interactions over followers</CardDescription>
              </div>
              <Link href="/channels" className="text-xs font-bold text-ink hover:underline">
                Manage channels
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            {perfRows.length === 0 ? (
              <p className="text-sm text-muted">
                Connect a channel and publish — audience and engagement land here within a day.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" aria-hidden="true" />
                        Views
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perfRows.map((r) => {
                    const eng = chanEng(r);
                    return (
                      <TableRow key={r.channelId}>
                        <TableCell>
                          <span className="flex items-center gap-2.5">
                            <BrandIcon provider={r.provider} className="h-7 w-7 shrink-0" />
                            <span className="truncate font-bold">{r.label}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-display font-extrabold" title={r.fetchedAt ? `Snapshot ${fmtDate(r.fetchedAt)}` : 'Awaiting first daily snapshot'}>
                          {full(r.followers)}
                        </TableCell>
                        <TableCell className="text-right text-muted">{full(r.likes)}</TableCell>
                        <TableCell className="text-right text-muted">{full(r.comments)}</TableCell>
                        <TableCell className="text-right text-muted">{full(r.shares)}</TableCell>
                        <TableCell className="text-right text-muted">{r.views === null ? '—' : full(r.views)}</TableCell>
                        <TableCell className="text-right font-bold">{eng ?? '—'}</TableCell>
                        <TableCell className="text-right text-muted">{r.sent}</TableCell>
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

      <Drawer
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export report"
        description={`${range.label}${chanSel.length ? ` · ${chanSel.map((p) => providerMeta(p).label).join(', ')}` : ' · all channels'}`}
      >
        <div className="space-y-2.5">
          <ExportOption
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            title="CSV"
            subtitle="Channel + top-post tables as a spreadsheet"
            onClick={() => {
              exportCsv();
              setExportOpen(false);
            }}
          />
          <ExportOption
            icon={<Download className="h-5 w-5" aria-hidden="true" />}
            title="Markdown"
            subtitle="Full report with summary and tables"
            onClick={() => {
              exportMarkdown();
              setExportOpen(false);
            }}
          />
          <ExportOption
            icon={<FileDown className="h-5 w-5" aria-hidden="true" />}
            title="PDF"
            subtitle="Opens a print-ready report — save as PDF"
            onClick={() => {
              exportPdf();
              setExportOpen(false);
            }}
          />
        </div>
      </Drawer>
    </div>
  );
}

function ExportOption({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper-dim p-4 text-left transition hover:border-accent hover:bg-accent-soft"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-ink">{title}</span>
        <span className="block text-xs text-muted">{subtitle}</span>
      </span>
    </button>
  );
}
