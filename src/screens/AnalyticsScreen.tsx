import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import NotificationBell from '../components/NotificationBell';
import CommentReport from '../components/CommentReport';
import { ChannelAvatar, AccountAvatars, Seg } from '../components/ui';
import { TrendChart, ChartModeToggle, type ChartMode } from '../components/charts';
import { Tabs } from '../components/ui-kit';
import { useTourTarget } from '../components/Tour';
import { SOCIAL_META, requiresTitle } from '../constants';
import { currentSession } from '../utils/supabase';
import {
  fetchCloudAnalytics,
  syncAnalytics,
  type CloudAnalytics,
  type CloudChannel,
  type CloudPost,
} from '../utils/cloudAnalytics';
import { tr } from '../i18n';
import {
  addLocalDays,
  addStats,
  emptyTotals,
  engagementRate,
  fillBuckets,
  followerSeries,
  interactionsOf,
  localDayOf,
  rangeBuckets,
  recentWeeks,
  weekdayCounts as countWeekdays,
  type EngagementTotals,
} from '../utils/analyticsMath';

/**
 * Mirrors the web analytics dashboard (apps/web AnalyticsDashboard): reads
 * the same cloud tables (posts, post_stats, channel_stats snapshots) and
 * renders the same cards, stat grid, pipeline, weekly/weekday rhythm,
 * top posts, recently sent, channel performance.
 */

type RangePreset = 'last7' | 'last30' | 'mtd';

/** Range pills; labels are dictionary keys, translated at render. */
const PRESETS: { id: RangePreset; key: string }[] = [
  { id: 'last7', key: 'dLast7' },
  { id: 'last30', key: 'iLast30' },
  { id: 'mtd', key: 'iMtd' },
];

function compact(n: number | null): string {
  if (n === null || n === undefined) return '-';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/** Exact count with thousands separators, follower totals must match the
 *  snapshot digit-for-digit. */
function full(n: number | null): string {
  if (n === null || n === undefined) return '-';
  try {
    return Math.round(n).toLocaleString('en-US');
  } catch {
    return String(Math.round(n));
  }
}

const fmtDate = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function AnalyticsScreen({ onConnect, onBack }: {
  onConnect: () => void;
  /** Present when reached from Home, back chevron. */
  onBack?: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const tourRange = useTourTarget('tour-analytics-range', { insetX: 24, radius: 999 });
  const tourMetrics = useTourTarget('tour-analytics-metrics', { insetX: 20, radius: 22 });
  const [data, setData] = useState<CloudAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preset, setPreset] = useState<RangePreset>('last30');
  const [chanSel, setChanSel] = useState<string[]>([]);
  const [metric, setMetric] = useState<'posts' | 'followers' | 'engagement' | 'interactions'>('posts');
  const [rhythm, setRhythm] = useState<'weeks' | 'weekdays'>('weeks');
  // Same defaults as web: the hero opens as a line, the rhythm as bars.
  const [perfMode, setPerfMode] = useState<ChartMode>('line');
  // Which posts the numbers cover: Sosial's, ones posted directly, or both.
  const [source, setSource] = useState<'all' | 'sosial' | 'native'>('all');
  const [rhythmMode, setRhythmMode] = useState<ChartMode>('bar');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCloudAnalytics());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Snapshots used to refresh only once a day, so pulling down re-read stale
  // rows. Now opening the screen and pulling both ask the worker for fresh
  // numbers and re-read every time a newer snapshot lands.
  const stopSync = useRef<(() => void) | null>(null);
  const startSync = useCallback(() => {
    stopSync.current?.();
    stopSync.current = syncAnalytics(() => {
      void fetchCloudAnalytics().then((d) => d && setData(d)).catch(() => {});
    });
  }, []);

  useEffect(() => {
    void load();
    void currentSession().catch(() => null);
    startSync();
    return () => stopSync.current?.();
  }, [load, startSync]);

  const onRefresh = async () => {
    setRefreshing(true);
    startSync();
    try {
      setData(await fetchCloudAnalytics());
    } finally {
      setRefreshing(false);
    }
  };

  // Pinned to the latest data (and preset change) rather than read on every
  // render: a fresh Date.now() each render rebuilt the range, so every
  // memo below (scoped posts, top posts, channel rows) recomputed per frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [data, preset]);
  const range = useMemo((): { from: number; to: number; label: string } => {
    // Calendar days, not n × 24h, so a DST switch never adds or drops a day
    // (utils/analyticsMath, same as web).
    const endOfToday = addLocalDays(now, 1) - 1;
    if (preset === 'last7') return { from: addLocalDays(now, -6), to: endOfToday, label: tr('dLast7') };
    if (preset === 'last30') return { from: addLocalDays(now, -29), to: endOfToday, label: tr('iLast30') };
    const d = new Date(now);
    return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: endOfToday, label: tr('iMtd') };
  }, [preset, now]);

  const connected = useMemo(
    () => (data?.channels ?? []).filter((c) => c.status === 'connected'),
    [data],
  );

  const inRange = (iso: string | null | undefined): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= range.from && t <= range.to;
  };
  const postDate = (p: CloudPost): string | null => p.sent_at ?? p.scheduled_at ?? p.created_at ?? null;
  // Web parity: with no channel picked, totals cover live accounts only, so a
  // revoked account stops adding followers and reactions.
  const connectedIds = useMemo(() => new Set(connected.map((c) => c.id)), [connected]);
  const chanOk = (channelId: string): boolean =>
    chanSel.length === 0 ? connectedIds.has(channelId) : chanSel.includes(channelId);
  const avatarOf = (channelId: string): string | undefined => data?.channels.find((c) => c.id === channelId)?.avatar;
  /** One avatar per account a post went out on. */
  const accountsOf = (p: CloudPost): { platform: string; avatar?: string }[] => {
    const seen = new Set<string>();
    return p.targets.flatMap((t) => {
      if (seen.has(t.channel_id)) return [];
      seen.add(t.channel_id);
      return [{ platform: t.provider, avatar: avatarOf(t.channel_id) }];
    });
  };

  const scoped = useMemo(() => {
    const posts = data?.posts ?? [];
    return posts.filter((p) => {
      if (!inRange(postDate(p))) return false;
      if (chanSel.length === 0) return true;
      return p.targets.some((t) => chanSel.includes(t.channel_id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range, chanSel]);

  const byStatus = (list: string[]) => scoped.filter((p) => list.includes(p.status));
  const drafts = byStatus(['draft']).length;
  const queued = byStatus(['queued', 'publishing', 'approval']).length;
  // Memoized: topPosts and perfRows key off this array's identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sent = useMemo(() => byStatus(['sent', 'partial']), [scoped]);
  const failed = byStatus(['failed']).length;
  const funnelMax = Math.max(1, drafts, queued, sent.length, failed);

  // Engagement aggregates, latest snapshots, not date-bound (like web).
  // Audience interactions only; see utils/analyticsMath for the definition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const withSosial = source !== 'native';
  const withNative = source !== 'sosial';
  const statsScoped = useMemo(
    () => (withSosial ? (data?.postStats ?? []).filter((r) => chanOk(r.channel_id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, chanSel, connectedIds, withSosial],
  );
  // Posts made directly on the platform (web parity): Sosial's own are in
  // post_stats, these rows are only the rest.
  const nativeScoped = useMemo(
    () => (withNative ? (data?.nativePosts ?? []).filter((r) => chanOk(r.channel_id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, chanSel, connectedIds, withNative],
  );
  const nativeInRange = useMemo(
    () => nativeScoped.filter((r) => inRange(r.posted_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nativeScoped, range],
  );
  const sentInScope = withSosial ? sent : [];
  const totals = useMemo(
    () => [...statsScoped, ...nativeScoped].reduce((acc, r) => addStats(acc, r), emptyTotals()),
    [statsScoped, nativeScoped],
  );
  const interactions = interactionsOf(totals);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chanStatsScoped = useMemo(() => (data?.channelStats ?? []).filter((r) => chanOk(r.channel_id)), [data, chanSel, connectedIds]);
  const followers = chanStatsScoped.reduce((a, r) => a + (r.followers ?? 0), 0);
  const hasFollowers = chanStatsScoped.some((r) => r.followers !== null);
  const engPct = hasFollowers ? engagementRate(interactions, followers) : null;
  const eng = engPct === null ? null : `${engPct.toFixed(1)}%`;

  // Rhythm: the last 8 weeks whatever the range (it used to be cut from the
  // range-scoped posts, leaving most weeks at zero), weekdays within the range.
  const sentTimes = (list: CloudPost[]): number[] =>
    list.flatMap((p) => (p.sent_at ? [new Date(p.sent_at).getTime()] : [])).filter(Number.isFinite);
  const weeks = recentWeeks(
    now,
    sentTimes(
      (data?.posts ?? []).filter(
        (p) =>
          (p.status === 'sent' || p.status === 'partial') &&
          (chanSel.length === 0 || p.targets.some((t) => chanSel.includes(t.channel_id))),
      ),
    ),
  ).map((w) => ({ label: `${new Date(w.start).getMonth() + 1}/${new Date(w.start).getDate()}`, count: w.value }));
  const weekMax = Math.max(0, ...weeks.map((w) => w.count));
  const weekdayCounts = countWeekdays(sentTimes(sent));

  const recent = [...sent]
    .filter((p) => p.sent_at)
    .sort((a, b) => +new Date(b.sent_at!) - +new Date(a.sent_at!))
    .slice(0, 5);

  // Top posts: interactions summed across the post's targets.
  const statsByPost = useMemo(() => {
    const map = new Map<string, EngagementTotals>();
    for (const r of statsScoped) map.set(r.post_id, addStats(map.get(r.post_id) ?? emptyTotals(), r));
    return map;
  }, [statsScoped]);

  const topPosts = useMemo(() => {
    const rows: (EngagementTotals & {
      id: string;
      title: string;
      sentAt: string | null;
      accounts: { platform: string; avatar?: string }[];
      interactions: number;
      native?: boolean;
    })[] = sentInScope.map((p) => {
      const agg = statsByPost.get(p.id) ?? emptyTotals();
      return {
        ...agg,
        id: p.id,
        title: p.title || p.body?.slice(0, 60) || (requiresTitle(p.targets.map((t) => t.provider)) ? tr('aUntitled') : ''),
        sentAt: p.sent_at,
        accounts: accountsOf(p),
        interactions: interactionsOf(agg),
      };
    });
    for (const r of nativeInRange) {
      const agg = addStats(emptyTotals(), r);
      rows.push({
        ...agg,
        id: `native:${r.id}`,
        title: r.body?.slice(0, 60) || SOCIAL_META[r.provider]?.label || r.provider,
        sentAt: r.posted_at,
        accounts: [{ platform: r.provider, avatar: avatarOf(r.channel_id) }],
        interactions: interactionsOf(agg),
        native: true,
      });
    }
    rows.sort((a, b) => b.interactions - a.interactions);
    return rows.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentInScope, nativeInRange, statsByPost]);

  // Channel rows (latest snapshots, channel-filtered): who, then three numbers.
  const perfRows = useMemo(() => {
    const totalsBy = new Map<string, EngagementTotals>();
    for (const r of [...statsScoped, ...nativeScoped]) {
      totalsBy.set(r.channel_id, addStats(totalsBy.get(r.channel_id) ?? emptyTotals(), r));
    }
    return (data?.channels ?? [])
      .filter((c) => c.status === 'connected' || c.status === 'expired')
      .filter((c) => chanSel.length === 0 || chanSel.includes(c.id))
      .map((c: CloudChannel) => {
        const inter = interactionsOf(totalsBy.get(c.id));
        const snap = (data?.channelStats ?? []).find((sn) => sn.channel_id === c.id);
        const fol = snap?.followers ?? null;
        const pct = engagementRate(inter, fol);
        return {
          channel: c,
          label: c.display_name?.trim() || SOCIAL_META[c.provider]?.label || c.provider,
          sub: c.handle?.trim() ? `@${c.handle.trim().replace(/^@+/, '')}` : SOCIAL_META[c.provider]?.label ?? c.provider,
          followers: fol,
          interactions: inter,
          eng: pct === null ? null : `${pct.toFixed(1)}%`,
          sent: sent.filter((p) => p.targets.some((t) => t.channel_id === c.id && t.status === 'sent')).length,
        };
      })
      .filter((r) => r.sent > 0 || r.followers !== null || totalsBy.has(r.channel.id));
  }, [data, statsScoped, nativeScoped, sent, chanSel]);

  /** Hero series: every day of the range (weekly past ~2 months), zero-filled.
   *  Same buckets and rules as web (utils/analyticsMath). */
  const series = useMemo((): { label: string; value: number | null }[] => {
    const { buckets } = rangeBuckets(range.from, range.to);
    const label = (t: number): string => `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}`;
    if (metric === 'followers') {
      const captures = [
        ...(data?.followerHistory ?? [])
          .filter((r) => chanOk(r.channel_id))
          .map((r) => ({ channel_id: r.channel_id, at: localDayOf(r.captured_on), followers: r.followers })),
        ...chanStatsScoped.map((r) => ({ channel_id: r.channel_id, at: new Date(r.fetched_at).getTime(), followers: r.followers })),
      ];
      const values = followerSeries(buckets, captures);
      return buckets.map((b, i) => ({ label: label(b.start), value: values[i] }));
    }
    const events = [
      ...sentInScope.map((p) => ({
        at: p.sent_at ? new Date(p.sent_at).getTime() : Number.NaN,
        value: metric === 'posts' ? 1 : interactionsOf(statsByPost.get(p.id)),
      })),
      ...nativeInRange.map((r) => ({
        at: r.posted_at ? new Date(r.posted_at).getTime() : Number.NaN,
        value: metric === 'posts' ? 1 : interactionsOf(r),
      })),
    ].filter((e) => Number.isFinite(e.at));
    const filled = fillBuckets(buckets, events);
    if (metric === 'engagement') {
      return filled.map((b) => {
        const pct = hasFollowers ? engagementRate(b.value, followers) : null;
        return { label: label(b.start), value: pct === null ? 0 : Number(pct.toFixed(2)) };
      });
    }
    return filled.map((b) => ({ label: label(b.start), value: b.value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sentInScope, nativeInRange, statsByPost, range, metric, followers, hasFollowers, chanStatsScoped]);

  const metricCells: { id: typeof metric; label: string; value: string; desc: string }[] = [
    { id: 'posts', label: tr('iPosts'), value: full(sentInScope.length + nativeInRange.length), desc: tr('aDescPosts') },
    { id: 'followers', label: tr('dFollowers'), value: hasFollowers ? compact(followers) : '-', desc: tr('aDescFollowers') },
    { id: 'engagement', label: tr('iEng'), value: eng ?? '-', desc: tr('aDescEng') },
    { id: 'interactions', label: tr('dInteractions'), value: compact(interactions), desc: tr('aDescInter') },
  ];
  const chartLabels = { type: tr('aChartType'), line: tr('aChartLine'), bar: tr('aChartBar') };

  const pipe = [
    { label: tr('iDrafts'), value: drafts, color: C.faint },
    { label: tr('aStQueued'), value: queued, color: '#F2A400' },
    { label: tr('aStSent'), value: sent.length, color: C.ink },
    { label: tr('aStFailed'), value: failed, color: '#E5484D' },
  ];

  const statusChip = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'sent': return { label: tr('aStSent'), color: C.greenText };
      case 'partial': return { label: tr('aStPartial'), color: '#B45309' };
      case 'failed': return { label: tr('aStFailed'), color: C.redText };
      case 'publishing': return { label: tr('aStPublishing'), color: '#B45309' };
      case 'queued': return { label: tr('aStQueued'), color: '#B45309' };
      case 'approval': return { label: tr('aStReview'), color: '#7C5CF0' };
      default: return { label: tr('aStDraft'), color: C.muted };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 116 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        <View style={s.masthead}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={22} color={C.ink} />
              </TouchableOpacity>
            ) : null}
            <View>
              <Text style={[T.h1, { color: C.ink, fontSize: 30, lineHeight: 36 }]}>{tr('iTitle')}</Text>
            </View>
          </View>
          <NotificationBell />
        </View>

        <>
            {/* Range presets */}
            <View style={{ paddingHorizontal: 24, marginTop: 12 }} ref={tourRange} collapsable={false}>
              <Tabs
                options={PRESETS.map((p) => ({ value: p.id, label: tr(p.key) }))}
                value={preset}
                onChange={setPreset}
                accessibilityLabel="Date range"
              />
            </View>

            {/* Source: Sosial's posts, ones posted directly, or both (web parity) */}
            <View style={{ paddingHorizontal: 24, marginTop: 10 }}>
              <Seg
                accessibilityLabel={tr('aSrcAria')}
                value={source}
                onChange={setSource}
                options={[
                  { value: 'all', label: tr('aSrcAll') },
                  { value: 'sosial', label: tr('aSrcSosial') },
                  { value: 'native', label: tr('aSrcNative') },
                ]}
              />
            </View>

            {/* Channel filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 24, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => setChanSel([])}
                style={[s.chanChip, chanSel.length === 0 && { backgroundColor: C.ink, borderColor: C.ink }]}
                activeOpacity={0.75}
              >
                <Text style={[s.chanChipT, chanSel.length === 0 && { color: C.onInk }]}>{tr('iAll')}</Text>
              </TouchableOpacity>
              {connected.map((c) => {
                const on = chanSel.includes(c.id);
                const name = c.display_name?.trim() || SOCIAL_META[c.provider]?.label || c.provider;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setChanSel((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                    style={[s.chanChip, on && { backgroundColor: C.ink, borderColor: C.ink }]}
                    activeOpacity={0.75}
                  >
                    <ChannelAvatar platform={c.provider} avatar={c.avatar} size={22} ring={on ? C.ink : C.card} />
                    <Text style={[s.chanChipT, on && { color: C.onInk }]} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading && !data ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={C.accent} />
                <Text style={s.loadingT}>{tr('iCrunch')}</Text>
              </View>
            ) : connected.length === 0 ? (
              <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <View style={s.empty}>
                  <Text style={s.emptyT}>{tr('iNoCh')}</Text>
                  <Text style={s.emptyS}>{tr('aEmpty')}</Text>
                  <TouchableOpacity onPress={onConnect} style={s.connectBtn} activeOpacity={0.8}>
                    <Text style={s.connectBtnT}>{tr('iConnect')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Hero: four numbers as tabs over one chart (web parity). */}
                <View style={{ paddingHorizontal: 20, marginTop: 16 }} ref={tourMetrics} collapsable={false}>
                  <View style={[s.card, { padding: 0, overflow: 'hidden' }]}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {metricCells.map((m, i) => {
                        const on = metric === m.id;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            onPress={() => setMetric(m.id)}
                            activeOpacity={0.8}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: on }}
                            style={[
                              s.metricCell,
                              { backgroundColor: on ? C.card : C.surface },
                              i % 2 === 1 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: C.line },
                              i > 1 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
                            ]}
                          >
                            {on ? <View style={s.metricBar} /> : null}
                            <Text style={[s.kpiLabel, on && { color: C.ink }]} numberOfLines={1}>{m.label}</Text>
                            <Text style={s.kpiVal}>{m.value}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={{ padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={[s.secS, { flex: 1, marginTop: 0 }]}>
                          {metricCells.find((m) => m.id === metric)?.desc} · {range.label.toLowerCase()}
                        </Text>
                        <ChartModeToggle value={perfMode} onChange={setPerfMode} labels={chartLabels} />
                      </View>
                      <View style={{ marginTop: 12 }}>
                        <TrendChart
                          mode={perfMode}
                          data={series.map((b) => b.value)}
                          labels={series.map((b) => b.label)}
                          color={C.accent}
                          height={140}
                          formatValue={(v) => (metric === 'engagement' ? `${v.toFixed(1)}%` : full(v))}
                        />
                      </View>
                      {metric === 'interactions' || metric === 'engagement' ? (
                        <Text style={s.postMeta}>{tr('aInterNote')}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Top posts: ranked rows with their numbers */}
                <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                  <Text style={s.secT}>{tr('iTop')}</Text>
                  <Text style={s.secS}>Ranked by interactions · {range.label.toLowerCase()}</Text>
                  {topPosts.length === 0 ? (
                    <Text style={s.hint}>{tr('iNoTop')}</Text>
                  ) : (
                    <View style={[s.card, { marginTop: 10, paddingVertical: 4 }]}>
                      {topPosts.map((p, i) => (
                        <View key={p.id} style={[s.rankRow, i > 0 && s.divider]}>
                          <Text style={s.rank}>{i + 1}</Text>
                          <AccountAvatars accounts={p.accounts} size={26} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.postT} numberOfLines={1}>{p.title || tr('aUntitled')}</Text>
                            <View style={s.metaRow}>
                              <Text style={s.postS}>{fmtDate(p.sentAt)}</Text>
                              {p.native ? <Text style={s.postS}>{tr('aSrcNative')}</Text> : null}
                              <Stat icon="heart-outline" v={p.likes} C={C} />
                              <Stat icon="chatbubble-outline" v={p.comments} C={C} />
                              <Stat icon="repeat" v={p.shares} C={C} />
                              {p.saves > 0 ? <Stat icon="bookmark-outline" v={p.saves} C={C} /> : null}
                            </View>
                          </View>
                          <Text style={s.postInter}>{compact(p.interactions)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Pipeline: one stacked bar + legend */}
                <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                  <View style={s.card}>
                    <Text style={s.cardT}>{tr('iPipeline')}</Text>
                    <View style={s.stackBar}>
                      {pipe.map((f) =>
                        f.value > 0 ? <View key={f.label} style={{ flex: f.value, backgroundColor: f.color }} /> : null,
                      )}
                    </View>
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {pipe.map((f) => (
                        <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f.color }} />
                          <Text style={[s.postT, { flex: 1 }]}>{f.label}</Text>
                          <Text style={s.postInter}>{f.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Rhythm: weeks or weekdays */}
                <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={s.cardT}>{tr('iRhythm')}</Text>
                      <Seg
                        accessibilityLabel="Rhythm"
                        grow={false}
                        value={rhythm}
                        onChange={setRhythm}
                        options={[
                          { value: 'weeks', label: tr('aWeeks') },
                          { value: 'weekdays', label: tr('aWeekdays') },
                        ]}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
                      <Text style={[s.secS, { flex: 1, marginTop: 0 }]}>
                        {rhythm === 'weeks' ? tr('aRhythmWeeks').replace('{n}', String(weekMax)) : tr('aRhythmWeekdays')}
                      </Text>
                      <ChartModeToggle value={rhythmMode} onChange={setRhythmMode} labels={chartLabels} />
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <TrendChart
                        mode={rhythmMode}
                        data={rhythm === 'weeks' ? weeks.map((w) => w.count) : weekdayCounts}
                        labels={rhythm === 'weeks' ? weeks.map((w) => w.label) : tr('aWeekdayShort').split(',')}
                        color={C.accent}
                        height={110}
                        formatValue={(v) => String(Math.round(v))}
                      />
                    </View>
                  </View>
                </View>

                {/* Channels */}
                <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                  <Text style={s.secT}>{tr('iChannels')}</Text>
                  <Text style={s.secS}>{tr('aFollowersNote')}</Text>
                  {perfRows.length === 0 ? (
                    <Text style={s.hint}>{tr('aEmpty')}</Text>
                  ) : (
                    <View style={[s.card, { marginTop: 10, paddingVertical: 4 }]}>
                      {perfRows.map((r, i) => (
                        <View key={r.channel.id} style={[s.rankRow, i > 0 && s.divider]}>
                          <ChannelAvatar platform={r.channel.provider} avatar={r.channel.avatar} size={34} ring={C.card} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.postT} numberOfLines={1}>{r.label}</Text>
                            <Text style={s.postS} numberOfLines={1}>{r.sub}</Text>
                          </View>
                          <Num v={compact(r.followers)} label={tr('aFollowersWord')} s={s} />
                          <Num v={compact(r.interactions)} label={tr('dInteractions')} s={s} />
                          <Num v={r.eng ?? '-'} label={tr('iEng')} s={s} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Recently sent */}
                <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                  <Text style={s.secT}>{tr('dRecent')}</Text>
                  {recent.length === 0 ? (
                    <Text style={s.hint}>{tr('iNoSends')}</Text>
                  ) : (
                    <View style={[s.card, { marginTop: 10, paddingVertical: 4 }]}>
                      {recent.map((p, i) => {
                        const st = statusChip(p.status);
                        return (
                          <View key={p.id} style={[s.rankRow, i > 0 && s.divider]}>
                            <AccountAvatars accounts={accountsOf(p)} size={24} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.postT} numberOfLines={1}>
                                {p.title || p.body || (requiresTitle(p.targets.map((t) => t.provider)) ? tr('aUntitled') : '')}
                              </Text>
                              <Text style={s.postS}>{fmtDate(p.sent_at)}</Text>
                            </View>
                            <View style={[s.statusPill, { backgroundColor: `${st.color}1A` }]}>
                              <View style={[s.statusDot, { backgroundColor: st.color }]} />
                              <Text style={[s.statusT, { color: st.color }]}>{st.label}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </>
            )}
        </>

        <CommentReport
          from={range.from}
          to={range.to}
          channelIds={chanSel}
          channels={(data?.channels ?? []).map((c) => ({
            id: c.id,
            provider: c.provider,
            display_name: c.display_name,
            avatar: c.avatar,
          }))}
          rangeLabel={range.label}
        />
      </ScrollView>
    </View>
  );
}

/** One labelled number in an account row (same look as the comment report). */
function Num({ v, label, s }: { v: string; label: string; s: ReturnType<typeof makeS> }) {
  return (
    <View style={{ width: 62, alignItems: 'flex-end' }}>
      <Text style={s.numV} numberOfLines={1}>{v}</Text>
      <Text style={s.numL} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Stat({ icon, v, C }: { icon: keyof typeof Ionicons.glyphMap; v: number; C: Palette }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={11} color={C.faint} />
      <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.muted }}>{compact(v)}</Text>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.lineSoft, padding: 16 },
  cardT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: C.ink },
  metricCell: { width: '50%', paddingHorizontal: 16, paddingVertical: 14 },
  metricBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.accent },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
  rank: { width: 16, textAlign: 'center', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: C.faint },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 3 },
  brandTile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stackBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: C.surface, marginTop: 14 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  chanChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingLeft: 6, paddingRight: 13, paddingVertical: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  chanChipT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted, maxWidth: 130 },
  kpiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  kpi: { flexGrow: 1, flexBasis: '46%', backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: 14, gap: 3 },
  kpiLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted },
  kpiVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, letterSpacing: -0.6, color: C.ink, marginTop: 2 },
  kpiSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, lineHeight: 15, color: C.faint, marginTop: 2 },
  secT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, letterSpacing: -0.4, color: C.ink },
  secS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: C.muted, marginTop: 2 },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted, marginTop: 8 },
  postT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  postS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.muted },
  numV: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, letterSpacing: -0.3, color: C.ink, fontVariant: ['tabular-nums'] },
  numL: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase', color: C.faint, marginTop: 2 },
  postInter: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, letterSpacing: -0.4, color: C.ink },
  postMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 16, color: C.faint, marginTop: 8 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: R.lg, borderWidth: 1, padding: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5 },
  bestT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.faint },
  heroSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted, marginTop: 8 },
  empty: { backgroundColor: C.card, borderRadius: R.lg, padding: 28, alignItems: 'center' },
  emptyT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.ink },
  emptyS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  connectBtn: { backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, marginTop: 14 },
  connectBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.onInk },
  loadingT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 10 },
});
