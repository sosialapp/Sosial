'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart3, CalendarDays, Download, Eye, FileDown, FileText, Heart, Info, LineChart, MessageCircle, Percent, Repeat2, Send, Users,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { BrandIcon } from '@/components/BrandIcon';
import ChannelAvatar from '@/components/ChannelAvatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SegmentedPills from '@/components/ui/segmented-pills';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';
import { ChartBar, ChartLine, HBarList, type HBarRow } from '@/components/ui/chart';
import BarChartPanel from '@/components/analytics/BarChartPanel';
import ChannelBreakdownDialog from '@/components/analytics/ChannelBreakdownDialog';
import CommentReportCard, { type CommentReportRow } from '@/components/analytics/CommentReportCard';
import { channelAvatar } from '@/lib/channelAvatar';
import { primaryTarget } from '@/lib/postTargets';
import { fetchMediaForPosts } from '@/lib/posts';
import { createClient } from '@/lib/supabase/client';
import PostPreviewDialog, { type PreviewPostData } from '@/components/PostPreviewDialog';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { requiresTitle } from '@/lib/compat';
import type { ConnectedChannel, MediaAssetRow, PostStatus, PostWithTargets, ProviderKey } from '@/lib/types';

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

export interface FollowerHistoryRow {
  channel_id: string;
  provider: string;
  followers: number | null;
  captured_on: string;
}

type RangePreset = 'last7' | 'last30' | 'mtd' | 'custom';
type TopSortKey = 'interactions' | 'sent_at';
type PerfMetric = 'posts' | 'followers' | 'engagement' | 'interactions';

const DAY = 24 * 3600_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRESETS: { id: RangePreset; label: string; key?: string }[] = [
  { id: 'last7', label: '7 days', key: 'an7' },
  { id: 'last30', label: '30 days', key: 'an30' },
  { id: 'mtd', label: 'Month to date', key: 'anMtd' },
  { id: 'custom', label: 'Custom', key: 'anCustom' },
];

const fmtDate = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const full = (n: number | null): string => (n === null ? '-' : n.toLocaleString('en-US'));

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
  followerHistory,
  commentRows,
}: {
  posts: PostWithTargets[];
  channels: ConnectedChannel[];
  postStats: StatSnapshotRow[];
  channelStats: FollowerSnapshotRow[];
  followerHistory: FollowerHistoryRow[];
  commentRows: CommentReportRow[];
}) {
  const t = useT(appMessages);
  const now = Date.now();
  const [preset, setPreset] = useState<RangePreset>('last30');
  const [custom, setCustom] = useState<DateRange | undefined>();
  const [calOpen, setCalOpen] = useState(false);
  const [chanSel, setChanSel] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [perfMode, setPerfMode] = useState<'line' | 'bar'>('line');
  const [perfMetric, setPerfMetric] = useState<PerfMetric>('posts');
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [topSort, setTopSort] = useState<{ key: TopSortKey; dir: 'asc' | 'desc' }>({
    key: 'interactions',
    dir: 'desc',
  });

  // Click-to-preview: any post row opens the shared social preview (media is
  // fetched on demand and cached per post).
  const [preview, setPreview] = useState<PreviewPostData | null>(null);
  const [previewMedia, setPreviewMedia] = useState<Record<string, MediaAssetRow[]>>({});
  const openToken = useRef(0);

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
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
  const avatarOf = (channelId: string): string | undefined => {
    const c = channelById.get(channelId);
    return c ? channelAvatar(c.metadata) : undefined;
  };

  const openPreview = (
    post: PostWithTargets,
    stats: { likes: number; comments: number; shares: number; views: number | null } | null,
  ) => {
    const t = ++openToken.current;
    const t0 = primaryTarget(post);
    const provider = t0?.provider ?? 'instagram';
    const author = t0
      ? authorOf(t0.channel_id, provider)
      : { name: providerMeta(provider).label, handle: null };
    const when = post.sent_at ?? post.scheduled_at ?? post.created_at ?? '';
    const base: PreviewPostData = {
      id: post.id,
      text: post.body || post.title || '',
      status: post.status,
      timeLabel: when
        ? new Date(when).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '',
      timeTitle: when || undefined,
      provider,
      authorName: author.name,
      authorHandle: author.handle,
      avatar: t0 ? avatarOf(t0.channel_id) : undefined,
      media: previewMedia[post.id] ?? [],
      stats,
    };
    setPreview(base);
    if (previewMedia[post.id] || !post.workspace_id) return;
    void (async () => {
      try {
        const sb = createClient();
        const map = await fetchMediaForPosts(sb, post.workspace_id, [post.id]);
        const list = map[post.id] ?? [];
        if (openToken.current !== t) return;
        setPreviewMedia((prev) => ({ ...prev, [post.id]: list }));
        setPreview({ ...base, media: list });
      } catch {
        /* text-only preview stands */
      }
    })();
  };

  const range = useMemo((): { from: number; to: number; label: string } => {
    const sod = startOfDay(now);
    if (preset === 'last7') return { from: sod - 6 * DAY, to: sod + DAY - 1, label: t('anLast7') };
    if (preset === 'last30') return { from: sod - 29 * DAY, to: sod + DAY - 1, label: t('anLast30') };
    if (preset === 'mtd') {
      const d = new Date(now);
      return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: sod + DAY - 1, label: t('anMtd') };
    }
    const from = custom?.from ? startOfDay(custom.from.getTime()) : sod - 29 * DAY;
    const to = custom?.to ? startOfDay(custom.to.getTime()) + DAY - 1 : sod + DAY - 1;
    const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
  }, [preset, custom, now]);

  /** Connected channels on the account, one filter pill per account. */
  const connectedChannels = useMemo(
    () =>
      channels
        .filter((c) => c.status === 'connected')
        .sort((a, b) =>
          (a.display_name ?? providerMeta(a.provider).label).localeCompare(
            b.display_name ?? providerMeta(b.provider).label,
          ),
        ),
    [channels],
  );
  const chanLabel = (id: string): string => {
    const c = channels.find((x) => x.id === id);
    return c?.display_name || (c ? providerMeta(c.provider).label : id);
  };
  const chanSelLabels = (): string[] => chanSel.map(chanLabel);

  const inRange = (iso: string | null | undefined): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= range.from && t <= range.to;
  };
  const postDate = (p: PostWithTargets): string | null => p.sent_at ?? p.scheduled_at ?? p.created_at ?? null;
  const postInScope = (p: PostWithTargets): boolean => {
    if (!inRange(postDate(p))) return false;
    if (chanSel.length === 0) return true;
    return (p.post_targets ?? []).some((t) => chanSel.includes(t.channel_id));
  };

  const scoped = useMemo(() => posts.filter(postInScope), [posts, range, chanSel]);
  const byStatus = (s: string[]) => scoped.filter((p) => s.includes(p.status));
  const drafts = byStatus(['draft']).length;
  const queued = byStatus(['queued', 'publishing', 'approval']).length;
  const sent = byStatus(['sent', 'partial']);
  const failed = byStatus(['failed']).length;
  const funnelMax = Math.max(1, drafts, queued, sent.length, failed);

  // ---- engagement aggregates (latest snapshots; not date-bound) ----
  // Totals are about live accounts: a revoked or reconnected-away channel must
  // not keep contributing followers and reactions to the workspace numbers.
  const connectedIds = useMemo(
    () => new Set(channels.filter((c) => c.status === 'connected').map((c) => c.id)),
    [channels],
  );
  const chanOk = (channelId: string): boolean =>
    chanSel.length === 0 ? connectedIds.has(channelId) : chanSel.includes(channelId);
  // Comment report: same range as the cards above, own replies excluded so
  // the rate reflects incoming comments only. With no channel picked we keep
  // history from disconnected accounts too; comments are a record, not a
  // live stat.
  const reportRows = commentRows.filter(
    (c) => !c.is_own && inRange(c.created_at) && (chanSel.length === 0 || chanSel.includes(c.channel_id)),
  );
  const statsScoped = useMemo(
    () => postStats.filter((r) => chanOk(r.channel_id)),
    [postStats, chanSel],
  );
  const likes = statsScoped.reduce((a, r) => a + (r.likes ?? 0), 0);
  const comments = statsScoped.reduce((a, r) => a + (r.comments ?? 0), 0);
  const shares = statsScoped.reduce((a, r) => a + (r.shares ?? 0), 0);
  const views = statsScoped.reduce((a, r) => a + (r.views == null ? 0 : Number(r.views)), 0);
  const hasViews = statsScoped.some((r) => r.views != null);
  const chanStatsScoped = useMemo(
    () => channelStats.filter((r) => chanOk(r.channel_id)),
    [channelStats, chanSel],
  );
  const followerHistoryScoped = useMemo(
    () => followerHistory.filter((r) => chanOk(r.channel_id)),
    [followerHistory, chanSel],
  );
  const followers = chanStatsScoped.reduce((a, r) => a + (r.followers ?? 0), 0);
  const hasFollowers = chanStatsScoped.some((r) => r.followers !== null);
  // How much of the account the follower total actually covers, so a partial
  // sum never reads as the whole audience.
  const followersReporting = chanStatsScoped.filter((r) => r.followers !== null).length;
  const followersScope = chanSel.length > 0 ? chanSel.length : connectedIds.size;
  const eng =
    hasFollowers && followers > 0 ? `${(((likes + comments + shares) / followers) * 100).toFixed(1)}%` : null;

  const funnel: { label: string; value: number; href: string; color: string }[] = [
    { label: t('stDrafts'), value: drafts, href: '/queue', color: 'var(--color-surface)' },
    { label: t('stQueued'), value: queued, href: '/calendar', color: 'var(--color-bolt)' },
    { label: t('stSent'), value: sent.length, href: '/queue', color: 'var(--color-ink)' },
    { label: t('stFailed'), value: failed, href: '/queue', color: '#E60023' },
  ];

  const interactions = likes + comments + shares;

  // Stat cards are pickers: clicking one drives the Performance-over-time
  // chart, the ⓘ explains each number.
  const stats: {
    metric: PerfMetric;
    label: string;
    value: string;
    icon: typeof Send;
    hint: string;
    note?: string | null;
  }[] = [
    {
      metric: 'posts',
      label: t('anPostsPublished'),
      value: full(sent.length),
      icon: Send,
      hint: fill(t('anPostsHint'), { range: range.label }),
    },
    {
      metric: 'followers',
      label: t('anTotalFollowers'),
      value: hasFollowers ? full(followers) : '-',
      icon: Users,
      hint: t('anFollowersHint'),
      note:
        followersScope > 0 && followersReporting < followersScope
          ? fill(t('anFollowersPartial'), { n: followersReporting, m: followersScope })
          : null,
    },
    {
      metric: 'engagement',
      label: t('anEngRate'),
      value: eng ?? '-',
      icon: Percent,
      hint: t('anEngHint'),
    },
    {
      metric: 'interactions',
      label: t('anTotalInt'),
      value: full(interactions),
      icon: Heart,
      hint: t('anIntHint'),
    },
  ];

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
        title: p.title || p.body?.slice(0, 60) || (requiresTitle(providers) ? 'Untitled post' : ''),
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
    .filter((c) => chanSel.length === 0 || chanSel.includes(c.id))
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

  // ---- performance over time: the selected stat card, bucketed ----
  // Post stats are latest-only, so a post's numbers are attributed to the day
  // it went out. Daily buckets, weekly once the range passes ~2 months.
  // Followers come from p77's daily history: each channel's last known total is
  // carried forward so the line steps instead of dipping to zero.
  const perfSeries = useMemo(() => {
    const first = startOfDay(range.from);
    const last = startOfDay(range.to);
    const span = Math.max(1, Math.round((last - first) / DAY) + 1);
    const step = span > 62 ? 7 : 1;
    const buckets: { label: string; value: number; ts: number }[] = [];
    for (let t = first; t <= last; t += step * DAY) {
      buckets.push({
        label: new Date(t).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        value: 0,
        ts: t,
      });
    }
    if (perfMetric === 'followers') {
      const perChannel = new Map<string, { t: number; v: number }[]>();
      for (const r of followerHistoryScoped) {
        if (r.followers === null) continue;
        const t = new Date(`${r.captured_on}T00:00:00`).getTime();
        if (Number.isNaN(t)) continue;
        const arr = perChannel.get(r.channel_id) ?? [];
        arr.push({ t, v: r.followers });
        perChannel.set(r.channel_id, arr);
      }
      if (perChannel.size === 0) {
        // No history recorded yet (table was just created): flat current total.
        return buckets.map((b) => ({ ...b, value: hasFollowers ? followers : 0 }));
      }
      for (const arr of perChannel.values()) arr.sort((a, b) => a.t - b.t);
      const cursor = new Map<string, number>();
      const latest = new Map<string, number>();
      return buckets.map((b) => {
        const through = b.ts + step * DAY - 1;
        for (const [cid, arr] of perChannel) {
          let i = cursor.get(cid) ?? 0;
          while (i < arr.length && arr[i].t <= through) {
            latest.set(cid, arr[i].v);
            i += 1;
          }
          cursor.set(cid, i);
          // Bucket predates the first capture: hold the earliest known total.
          if (!latest.has(cid)) latest.set(cid, arr[0].v);
        }
        let total = 0;
        for (const v of latest.values()) total += v;
        return { ...b, value: total };
      });
    }
    for (const p of sent) {
      if (!p.sent_at) continue;
      const t = new Date(p.sent_at).getTime();
      if (Number.isNaN(t) || t < first || t > last) continue;
      const i = Math.floor((startOfDay(t) - first) / DAY / step);
      if (i < 0 || i >= buckets.length) continue;
      if (perfMetric === 'posts') {
        buckets[i].value += 1;
      } else {
        const agg = statsByPost.get(p.id);
        buckets[i].value += (agg?.likes ?? 0) + (agg?.comments ?? 0) + (agg?.shares ?? 0);
      }
    }
    // Count-based metrics are empty while nothing has published yet, which left
    // the line/bars clinging to the right edge. Drop the dead lead-in so the
    // trend uses the whole card: keep one bucket of context and at least a week
    // of axis so a lone recent post still reads as a trend.
    const trim = (rows: typeof buckets): typeof buckets => {
      const firstIdx = rows.findIndex((b) => b.value > 0);
      if (firstIdx <= 1) return rows;
      const start = Math.max(0, Math.min(firstIdx - 1, rows.length - 7));
      return start > 0 ? rows.slice(start) : rows;
    };
    if (perfMetric === 'engagement') {
      const denom = hasFollowers && followers > 0 ? followers : 0;
      return trim(buckets.map((b) => ({ ...b, value: denom ? Number(((b.value / denom) * 100).toFixed(2)) : 0 })));
    }
    return trim(buckets);
  }, [sent, statsByPost, range, perfMetric, followers, hasFollowers, followerHistoryScoped]);
  const perfXInterval = Math.max(0, Math.ceil(perfSeries.length / 8) - 1);
  const perfDesc: Record<PerfMetric, string> = {
    posts: 'Posts published each day',
    followers: 'Follower total, daily snapshots carried forward',
    engagement: 'Interactions ÷ followers, from the latest snapshots',
    interactions: 'Interactions from posts published each day',
  };
  const perfFmt = (v: string | number): string =>
    perfMetric === 'engagement' ? `${Number(v).toFixed(1)}%` : full(Number(v));

  // ---- channel breakdown: interactions + audience per channel, biggest first ----
  const breakdown = perfRows
    .map((r) => ({ r, total: r.likes + r.comments + r.shares }))
    .sort((a, b) => b.total - a.total);
  const breakdownMax = Math.max(1, ...breakdown.map((b) => b.total));
  const breakdownRows: HBarRow[] = breakdown.map(({ r, total }) => ({
    key: r.channelId,
    label: (
      <span className="flex items-center gap-2">
        <BrandIcon provider={r.provider} className="h-5 w-5 shrink-0" />
        <span className="truncate">{r.label}</span>
      </span>
    ),
    value: total,
    max: breakdownMax,
    color: 'var(--color-bolt)',
    trailing: full(total),
    hint: `${r.followers === null ? '-' : full(r.followers)} ${t('anFollowersWord')} · ${chanEng(r) ?? '-'} ${t('anEngagementWord')} · ${r.sent} ${t('anSentWord')}`,
  }));

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
      `# Sosial analytics, ${range.label}`,
      `Exported ${stamp}`,
      '',
      `**Posts:** ${sent.length} · **Followers:** ${hasFollowers ? followers.toLocaleString('en-US') : '-'} · **Reactions:** ${likes.toLocaleString('en-US')} · **Comments:** ${comments.toLocaleString('en-US')} · **Eng. rate:** ${eng ?? '-'} · **Views:** ${hasViews ? views.toLocaleString('en-US') : '-'}`,
      '',
      '## Channels',
      '',
      '| Channel | Followers | Likes | Comments | Shares | Views | Engagement | Sent |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...perfRows.map(
        (r) =>
          `| ${r.label} | ${r.followers ?? '-'} | ${r.likes} | ${r.comments} | ${r.shares} | ${r.views ?? '-'} | ${chanEng(r) ?? '-'} | ${r.sent} |`,
      ),
      '',
      '## Top posts',
      '',
      '| Post | Sent | Channels | Likes | Comments | Shares | Views | Interactions |',
      '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
      ...topPosts.map(
        (p) =>
          `| ${p.title.replace(/\|/g, '\\|').slice(0, 80)} | ${p.sentAt ? new Date(p.sentAt).toISOString().slice(0, 10) : '-'} | ${p.providers.map((pv) => providerMeta(pv).label).join(' + ')} | ${p.likes} | ${p.comments} | ${p.shares} | ${p.views ?? '-'} | ${p.interactions} |`,
      ),
      '',
    ];
    download(`sosial-analytics-${stamp}.md`, 'text/markdown', md.join('\n'));
  };

  const exportPdf = (): void => {
    const row = (cells: string[]): string =>
      `<tr>${cells.map((c, i) => `<td style="padding:7px 10px;border-bottom:1px solid #eee;${i > 0 ? 'text-align:right;' : ''}font-size:12px;">${c}</td>`).join('')}</tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sosial analytics, ${range.label}</title></head><body style="font-family:system-ui,sans-serif;color:#1C1A14;max-width:900px;margin:32px auto;padding:0 24px;">
<h1 style="font-size:22px;">Sosial analytics, ${range.label}</h1>
<p style="color:#666;font-size:12px;">Exported ${stamp}${chanSel.length ? ` · Channels: ${chanSelLabels().join(', ')}` : ''}</p>
<p style="font-size:13px;"><b>Posts:</b> ${sent.length} · <b>Followers:</b> ${hasFollowers ? followers.toLocaleString('en-US') : '-'} · <b>Reactions:</b> ${likes.toLocaleString('en-US')} · <b>Comments:</b> ${comments.toLocaleString('en-US')} · <b>Eng. rate:</b> ${eng ?? '-'} · <b>Views:</b> ${hasViews ? views.toLocaleString('en-US') : '-'}</p>
<h2 style="font-size:16px;margin-top:28px;">${t('anPdfChannelsH')}</h2>
<table style="border-collapse:collapse;width:100%;"><thead><tr>${['Channel', 'Followers', 'Likes', 'Comments', 'Shares', 'Views', 'Engagement', 'Sent'].map((h, i) => `<th style="text-align:${i === 0 ? 'left' : 'right'};padding:7px 10px;border-bottom:2px solid #1C1A14;font-size:12px;">${h}</th>`).join('')}</tr></thead><tbody>
${perfRows.map((r) => row([r.label, r.followers === null ? '-' : String(r.followers), String(r.likes), String(r.comments), String(r.shares), r.views === null ? '-' : String(r.views), chanEng(r) ?? '-', String(r.sent)])).join('')}
</tbody></table>
<h2 style="font-size:16px;margin-top:28px;">${t('anPdfTopH')}</h2>
<table style="border-collapse:collapse;width:100%;"><thead><tr>${['Post', 'Sent', 'Channels', 'Likes', 'Comments', 'Shares', 'Views', 'Interactions'].map((h, i) => `<th style="text-align:${i < 3 ? 'left' : 'right'};padding:7px 10px;border-bottom:2px solid #1C1A14;font-size:12px;">${h}</th>`).join('')}</tr></thead><tbody>
${topPosts.map((p) => `<tr>${[p.title.slice(0, 90), p.sentAt ? new Date(p.sentAt).toISOString().slice(0, 10) : '-', p.providers.map((pv) => providerMeta(pv).label).join(' + ')].map((c) => `<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;">${c}</td>`).join('')}${[p.likes, p.comments, p.shares, p.views ?? '-', p.interactions].map((c) => `<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right;">${c}</td>`).join('')}</tr>`).join('')}
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

  const pipeTotal = Math.max(1, drafts + queued + sent.length + failed);

  return (
    <div className="w-full pt-3 sm:px-2 sm:pt-4">
      {/* Header: title + the range in words, export on the right. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t('anH1')}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {range.label}
            {chanSel.length ? ` · ${chanSelLabels().join(', ')}` : ''}
          </p>
        </div>
        <Popover open={exportOpen} onOpenChange={setExportOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-bold text-soft transition hover:bg-surface"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t('anExport')}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="end">
            <p className="px-2 pt-1 pb-2 text-[11px] font-extrabold uppercase tracking-wide text-faint">{t('anExportReport')}</p>
            <div className="space-y-1">
              <ExportOption
                icon={<FileText className="h-4 w-4" aria-hidden="true" />}
                title="CSV"
                subtitle={t('anCsvSub')}
                onClick={() => {
                  exportCsv();
                  setExportOpen(false);
                }}
              />
              <ExportOption
                icon={<Download className="h-4 w-4" aria-hidden="true" />}
                title="Markdown"
                subtitle={t('anMdSub')}
                onClick={() => {
                  exportMarkdown();
                  setExportOpen(false);
                }}
              />
              <ExportOption
                icon={<FileDown className="h-4 w-4" aria-hidden="true" />}
                title="PDF"
                subtitle={t('anPdfSub')}
                onClick={() => {
                  exportPdf();
                  setExportOpen(false);
                }}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Controls: range switch, then the channel filter as one swipeable row. */}
      <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:items-center" data-tour="analytics-range">
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverAnchor asChild>
            <div className="max-w-full shrink-0">
              <SegmentedPills
                ariaLabel={t('anCustom')}
                value={preset}
                onChange={setPreset}
                size="md"
                options={[
                  ...PRESETS.filter((p) => p.id !== 'custom').map((p) => ({
                    value: p.id,
                    label: t(p.key ?? p.label),
                  })),
                  {
                    value: 'custom' as const,
                    onSelect: () => {
                      setPreset('custom');
                      setCalOpen(true);
                    },
                    label: (
                      <>
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {preset === 'custom' && custom?.from ? range.label : t('anCustom')}
                      </>
                    ),
                  },
                ]}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" defaultMonth={custom?.from} selected={custom} onSelect={setCustom} numberOfMonths={1} />
            <div className="flex items-center justify-between gap-2 border-t border-line-soft p-3">
              <button
                type="button"
                onClick={() => setCustom(undefined)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-muted transition hover:text-ink"
              >
                {t('cpClear')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreset('custom');
                  setCalOpen(false);
                }}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-on-accent transition hover:bg-accent-bright"
              >
                {t('hubSave')}
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <span className="hidden h-6 w-px bg-line lg:block" aria-hidden="true" />
        <div className="no-scrollbar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1" role="group" aria-label={t('anFilterChan')}>
          <button
            type="button"
            aria-pressed={chanSel.length === 0}
            onClick={() => setChanSel([])}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-bold transition ${
              chanSel.length === 0 ? 'border-ink bg-ink text-bone' : 'border-line bg-card text-muted hover:text-ink'
            }`}
          >
            All channels
          </button>
          {connectedChannels.map((c) => {
            const on = chanSel.includes(c.id);
            const name = c.display_name || providerMeta(c.provider).label;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleChan(c.id)}
                title={`${name} · ${providerMeta(c.provider).label}`}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1 text-xs font-bold transition ${
                  on ? 'border-ink bg-ink text-bone' : 'border-line bg-card text-soft hover:border-faint'
                }`}
              >
                <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={26} />
                <span className="max-w-32 truncate">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero: the four numbers as tabs over one chart, like a real analytics
          home. Picking a number redraws the chart below it. */}
      <Card className="mt-4 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4" role="tablist" aria-label={t('anPerfChart')}>
          {stats.map((s, i) => {
            const on = s.metric === perfMetric;
            return (
              <div
                key={s.label}
                role="tab"
                tabIndex={0}
                aria-selected={on}
                aria-label={fill(t('anShowChart'), { label: s.label })}
                onClick={() => setPerfMetric(s.metric)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPerfMetric(s.metric);
                  }
                }}
                className={`relative cursor-pointer border-line p-4 text-left transition sm:p-5 ${
                  i % 2 === 1 ? 'border-l' : ''
                } ${i > 1 ? 'border-t lg:border-t-0' : ''} ${i > 0 ? 'lg:border-l' : ''} ${
                  on ? 'bg-card' : 'bg-surface/50 hover:bg-surface'
                }`}
              >
                {on ? <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" /> : null}
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${on ? 'text-ink' : 'text-muted'}`}>
                    <s.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {s.label}
                  </span>
                  <Tooltip content={s.hint} align="end">
                    <button
                      type="button"
                      aria-label={s.hint}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="grid h-5 w-5 place-items-center rounded-full text-faint transition hover:text-ink"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
                <p className="mt-2 font-display text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[2rem]">
                  {s.value}
                </p>
                {s.note ? <p className="mt-1.5 text-[10px] leading-tight text-faint">{s.note}</p> : null}
              </div>
            );
          })}
        </div>
        <div className="border-t border-line px-4 pt-4 pb-3 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {perfDesc[perfMetric]} · {range.label.toLowerCase()}
            </p>
            <SegmentedPills
              ariaLabel={t('anChartType')}
              size="sm"
              value={perfMode}
              onChange={setPerfMode}
              options={[
                {
                  value: 'line',
                  label: (
                    <>
                      <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
                      Line
                    </>
                  ),
                },
                {
                  value: 'bar',
                  label: (
                    <>
                      <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Bar
                    </>
                  ),
                },
              ]}
            />
          </div>
          {perfMode === 'line' ? (
            <ChartLine
              data={perfSeries}
              dataKey="value"
              labelKey="label"
              color="var(--color-accent)"
              height={260}
              xInterval={perfXInterval}
              formatter={perfFmt}
            />
          ) : (
            <ChartBar
              data={perfSeries}
              dataKey="value"
              labelKey="label"
              color="var(--color-bolt)"
              height={260}
              xInterval={perfXInterval}
              formatter={perfFmt}
            />
          )}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top posts: ranked rows with each post's numbers, not a wide table. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t('anTopPosts')}</CardTitle>
                <CardDescription>{fill(t('anTopDesc'), { range: range.label })}</CardDescription>
              </div>
              <SegmentedPills
                ariaLabel="Sort top posts"
                size="sm"
                value={topSort.key}
                onChange={(k) => setTopSort({ key: k, dir: 'desc' })}
                options={[
                  { value: 'interactions', label: 'Most engaged' },
                  { value: 'sent_at', label: 'Newest' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {topPosts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t('anNoSent')}</p>
            ) : (
              <ol className="divide-y divide-line-soft">
                {topPosts.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const fullPost = sent.find((s) => s.id === p.id);
                        if (fullPost) {
                          openPreview(fullPost, { likes: p.likes, comments: p.comments, shares: p.shares, views: p.views });
                        }
                      }}
                      className="group flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="w-5 shrink-0 text-center font-display text-sm font-extrabold tabular-nums text-faint">
                        {i + 1}
                      </span>
                      <span className="flex shrink-0 items-center">
                        {p.providers.slice(0, 3).map((pv, j) => (
                          <span
                            key={pv}
                            className="rounded-full ring-2 ring-card"
                            style={{ marginLeft: j ? -8 : 0, zIndex: p.providers.length - j }}
                            title={providerMeta(pv).label}
                          >
                            <BrandIcon provider={pv} className="h-7 w-7" />
                          </span>
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold group-hover:underline">{p.title || t('untitled')}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                          <span>{fmtDate(p.sentAt)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3 w-3" aria-hidden="true" />
                            {full(p.likes)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" aria-hidden="true" />
                            {full(p.comments)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Repeat2 className="h-3 w-3" aria-hidden="true" />
                            {full(p.shares)}
                          </span>
                          {p.views !== null ? (
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" aria-hidden="true" />
                              {full(p.views)}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-display text-lg font-extrabold leading-none tabular-nums">{full(p.interactions)}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-faint">{t('anTotalInt')}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Channel breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t('anChanBreakdown')}</CardTitle>
              {breakdown.length > 4 ? (
                <button type="button" onClick={() => setBreakdownOpen(true)} className="text-xs font-bold text-ink hover:underline">
                  See all
                </button>
              ) : (
                <Link href="/channels" className="text-xs font-bold text-ink hover:underline">
                  Manage
                </Link>
              )}
            </div>
            <CardDescription>{t('anChanDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted">Connect a channel and publish, its numbers land here within a day.</p>
            ) : (
              <>
                <HBarList rows={breakdownRows.slice(0, 5)} />
                {breakdown.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setBreakdownOpen(true)}
                    className="mt-3 w-full rounded-full bg-surface px-3 py-2 text-xs font-bold text-ink transition hover:bg-line-soft"
                  >
                    See all {breakdown.length} channels
                  </button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Pipeline as one stacked bar with a legend: where everything stands. */}
        <Card>
          <CardHeader>
            <CardTitle>{t('anPipeline')}</CardTitle>
            <CardDescription>{range.label}</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="flex h-3 overflow-hidden rounded-full bg-surface" aria-hidden="true">
              {funnel.map((f) =>
                f.value > 0 ? (
                  <span
                    key={f.label}
                    style={{ width: `${(f.value / pipeTotal) * 100}%`, background: f.color === 'var(--color-surface)' ? '#9A958B' : f.color }}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-4 space-y-1">
              {funnel.map((f) => (
                <li key={f.label}>
                  <Link href={f.href} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-surface">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: f.color === 'var(--color-surface)' ? '#9A958B' : f.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm font-bold text-soft">{f.label}</span>
                    <span className="font-display text-base font-extrabold tabular-nums">{f.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Rhythm: weekly volume and best weekday side by side. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('anPerWeek')}</CardTitle>
              <CardDescription>best: {weekMax}/wk</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 pt-1 md:grid-cols-2">
            <BarChartPanel data={weeks} dataKey="count" labelKey="label" domainMax={weekMax} height={176} suffix="sent" />
            <div>
              <p className="mb-2 text-xs font-bold text-muted">{t('anPerWeekday')}</p>
              <BarChartPanel data={weekdayData} dataKey="count" labelKey="label" domainMax={weekdayMax} height={156} suffix="sent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recently sent, as a compact feed strip. */}
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('anRecent')}</CardTitle>
            <Link href="/queue" className="text-xs font-bold text-ink hover:underline">
              Queue
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recent.length === 0 ? (
            <p className="text-sm text-muted">{t('anNoSends')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {recent.slice(0, 8).map((p) => {
                const providers = [...new Set((p.post_targets ?? []).map((tg) => tg.provider))];
                const st = POST_STATUS_META[p.status];
                const agg = statsByPost.get(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        openPreview(
                          p,
                          agg ? { likes: agg.likes, comments: agg.comments, shares: agg.shares, views: agg.views } : null,
                        )
                      }
                      className="flex h-full w-full flex-col rounded-2xl border border-line-soft bg-paper p-3 text-left transition hover:border-line"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex items-center">
                          {providers.slice(0, 3).map((pv, i) => (
                            <span key={pv} className="rounded-full ring-2 ring-paper" style={{ marginLeft: i ? -6 : 0 }}>
                              <BrandIcon provider={pv} className="h-5 w-5" />
                            </span>
                          ))}
                        </span>
                        <span className="flex-1 text-[11px] text-muted">{fmtDate(p.sent_at)}</span>
                        <Badge className={st.className}>{st.label}</Badge>
                      </span>
                      <span className="mt-2 line-clamp-2 text-[13px] leading-snug text-soft">
                        {p.title || p.body || (requiresTitle(providers) ? t('untitled') : '')}
                      </span>
                      {agg ? (
                        <span className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3 w-3" aria-hidden="true" />
                            {full(agg.likes)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" aria-hidden="true" />
                            {full(agg.comments)}
                          </span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 mb-2 px-1 text-xs leading-relaxed text-faint">{t('anStatsNote')}</p>

      <div data-tour="analytics-comments">
        <CommentReportCard
          rows={reportRows}
          rangeLabel={range.label}
          channelLabel={(channelId, provider) => authorOf(channelId, provider).name}
        />
      </div>

      <PostPreviewDialog post={preview} onClose={() => setPreview(null)} />
      <ChannelBreakdownDialog
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        rows={breakdownRows}
        subtitle={`Interactions, audience and engagement per channel · ${range.label.toLowerCase()}`}
      />
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
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-paper-dim"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-dim text-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-extrabold text-ink">{title}</span>
        <span className="block truncate text-[11px] text-muted">{subtitle}</span>
      </span>
    </button>
  );
}
