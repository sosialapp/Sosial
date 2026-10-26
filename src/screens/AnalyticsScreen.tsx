import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import NotificationBell from '../components/NotificationBell';
import { SocialGlyph, Seg } from '../components/ui';
import { BarsChart, HBarList } from '../components/charts';
import { Tabs } from '../components/ui-kit';
import { SOCIAL_META, requiresTitle } from '../constants';
import { currentSession } from '../utils/supabase';
import {
  fetchCloudAnalytics,
  type CloudAnalytics,
  type CloudChannel,
  type CloudPost,
} from '../utils/cloudAnalytics';
import { tr } from '../i18n';

/**
 * Mirrors the web analytics dashboard (apps/web AnalyticsDashboard): reads
 * the same cloud tables (posts, post_stats, channel_stats snapshots) and
 * renders the same cards, stat grid, pipeline, weekly/weekday rhythm,
 * top posts, recently sent, channel performance.
 */

const DAY = 86400000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const startOfDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

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
  const [data, setData] = useState<CloudAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preset, setPreset] = useState<RangePreset>('last30');
  const [chanSel, setChanSel] = useState<string[]>([]);
  const [metric, setMetric] = useState<'posts' | 'followers' | 'engagement' | 'interactions'>('posts');
  const [rhythm, setRhythm] = useState<'weeks' | 'weekdays'>('weeks');

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

  useEffect(() => {
    void load();
    void currentSession().catch(() => null);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setData(await fetchCloudAnalytics());
    } finally {
      setRefreshing(false);
    }
  };

  const now = Date.now();
  const range = useMemo((): { from: number; to: number; label: string } => {
    const sod = startOfDay(now);
    if (preset === 'last7') return { from: sod - 6 * DAY, to: sod + DAY - 1, label: tr('dLast7') };
    if (preset === 'last30') return { from: sod - 29 * DAY, to: sod + DAY - 1, label: tr('iLast30') };
    const d = new Date(now);
    return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: sod + DAY - 1, label: tr('iMtd') };
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
  const chanOk = (channelId: string): boolean => chanSel.length === 0 || chanSel.includes(channelId);

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
  const sent = byStatus(['sent', 'partial']);
  const failed = byStatus(['failed']).length;
  const funnelMax = Math.max(1, drafts, queued, sent.length, failed);

  // Engagement aggregates, latest snapshots, not date-bound (like web).
  const statsScoped = useMemo(() => (data?.postStats ?? []).filter((r) => chanOk(r.channel_id)), [data, chanSel]);
  const likes = statsScoped.reduce((a, r) => a + (r.likes ?? 0), 0);
  const comments = statsScoped.reduce((a, r) => a + (r.comments ?? 0), 0);
  const shares = statsScoped.reduce((a, r) => a + (r.shares ?? 0), 0);
  const views = statsScoped.reduce((a, r) => a + (r.views == null ? 0 : Number(r.views)), 0);
  const hasViews = statsScoped.some((r) => r.views != null);
  const chanStatsScoped = useMemo(() => (data?.channelStats ?? []).filter((r) => chanOk(r.channel_id)), [data, chanSel]);
  const followers = chanStatsScoped.reduce((a, r) => a + (r.followers ?? 0), 0);
  const hasFollowers = chanStatsScoped.some((r) => r.followers !== null);
  const eng = hasFollowers && followers > 0 ? `${(((likes + comments + shares) / followers) * 100).toFixed(1)}%` : null;

  // Weekly + weekday rhythm (range-scoped, from sent posts).
  const weeks: { label: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * DAY;
    const end = now - i * 7 * DAY;
    const count = sent.filter((p) => {
      if (!p.sent_at) return false;
      const t = new Date(p.sent_at).getTime();
      return t >= start && t < end;
    }).length;
    weeks.push({ label: `${new Date(end).getMonth() + 1}/${new Date(end).getDate()}`, count });
  }
  const weekMax = Math.max(1, ...weeks.map((w) => w.count));
  const weekdayCounts = new Array(7).fill(0);
  for (const p of sent) {
    if (!p.sent_at) continue;
    const d = new Date(p.sent_at);
    if (Number.isNaN(d.getTime())) continue;
    weekdayCounts[d.getDay()] += 1;
  }
  const weekdayMax = Math.max(1, ...weekdayCounts);

  const recent = [...sent]
    .filter((p) => p.sent_at)
    .sort((a, b) => +new Date(b.sent_at!) - +new Date(a.sent_at!))
    .slice(0, 5);

  // Top posts: interactions summed across the post's targets.
  const statsByPost = useMemo(() => {
    const map = new Map<string, { likes: number; comments: number; shares: number; views: number | null }>();
    for (const r of statsScoped) {
      const cur = map.get(r.post_id) ?? { likes: 0, comments: 0, shares: 0, views: null };
      cur.likes += r.likes ?? 0;
      cur.comments += r.comments ?? 0;
      cur.shares += r.shares ?? 0;
      if (r.views != null) cur.views = (cur.views ?? 0) + Number(r.views);
      map.set(r.post_id, cur);
    }
    return map;
  }, [statsScoped]);

  const topPosts = useMemo(() => {
    const rows = sent.map((p) => {
      const agg = statsByPost.get(p.id);
      const lk = agg?.likes ?? 0;
      const cm = agg?.comments ?? 0;
      const sh = agg?.shares ?? 0;
      return {
        id: p.id,
        title: p.title || p.body?.slice(0, 60) || (requiresTitle(p.targets.map((t) => t.provider)) ? 'Untitled post' : ''),
        sentAt: p.sent_at,
        providers: [...new Set(p.targets.map((t) => t.provider))],
        likes: lk,
        comments: cm,
        shares: sh,
        views: agg?.views ?? null,
        interactions: lk + cm + sh,
      };
    });
    rows.sort((a, b) => b.interactions - a.interactions);
    return rows.slice(0, 5);
  }, [sent, statsByPost]);

  // Channel performance rows (latest snapshots, channel-filtered).
  const totalsBy = useMemo(() => {
    const map = new Map<string, { likes: number; comments: number; shares: number; views: number | null }>();
    for (const r of statsScoped) {
      const cur = map.get(r.channel_id) ?? { likes: 0, comments: 0, shares: 0, views: null };
      cur.likes += r.likes ?? 0;
      cur.comments += r.comments ?? 0;
      cur.shares += r.shares ?? 0;
      if (r.views != null) cur.views = (cur.views ?? 0) + Number(r.views);
      map.set(r.channel_id, cur);
    }
    return map;
  }, [statsScoped]);

  const perfRows = useMemo(() => {
    return (data?.channels ?? [])
      .filter((c) => c.status === 'connected' || c.status === 'expired')
      .filter((c) => chanOk(c.id))
      .map((c: CloudChannel) => {
        const tot = totalsBy.get(c.id);
        const snap = chanStatsScoped.find((sn) => sn.channel_id === c.id);
        const sn2 = sent.filter((p) => p.targets.some((t) => t.channel_id === c.id && t.status === 'sent')).length;
        const fol = snap?.followers ?? null;
        return {
          channel: c,
          label: c.display_name?.trim() || SOCIAL_META[c.provider]?.label || c.provider,
          followers: fol,
          likes: tot?.likes ?? 0,
          comments: tot?.comments ?? 0,
          shares: tot?.shares ?? 0,
          views: tot?.views ?? null,
          sent: sn2,
          eng: fol && fol > 0 ? `${((((tot?.likes ?? 0) + (tot?.comments ?? 0) + (tot?.shares ?? 0)) / fol) * 100).toFixed(1)}%` : null,
        };
      })
      .filter((r) => r.sent > 0 || r.followers !== null);
  }, [data, chanStatsScoped, totalsBy, sent, chanSel]);

  /** Per-day series for the hero chart (weekly buckets past ~2 months). */
  const series = (() => {
    const first = startOfDay(range.from);
    const last = startOfDay(range.to);
    const span = Math.max(1, Math.round((last - first) / DAY) + 1);
    const step = span > 62 ? 7 : 1;
    const out: { label: string; value: number }[] = [];
    for (let t = first; t <= last; t += step * DAY) {
      out.push({ label: `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}`, value: 0 });
    }
    for (const p of sent) {
      if (!p.sent_at) continue;
      const t = new Date(p.sent_at).getTime();
      if (Number.isNaN(t) || t < first || t > last + DAY) continue;
      const i = Math.floor((startOfDay(t) - first) / DAY / step);
      if (i < 0 || i >= out.length) continue;
      if (metric === 'interactions') {
        const agg = statsByPost.get(p.id);
        out[i].value += (agg?.likes ?? 0) + (agg?.comments ?? 0) + (agg?.shares ?? 0);
      } else {
        out[i].value += 1;
      }
    }
    return out;
  })();

  const metricCells: { id: typeof metric; label: string; value: string; desc: string }[] = [
    { id: 'posts', label: tr('iPosts'), value: full(sent.length), desc: 'Posts published each day' },
    { id: 'followers', label: tr('dFollowers'), value: hasFollowers ? compact(followers) : '-', desc: 'Followers per channel, latest snapshot' },
    { id: 'engagement', label: tr('iEng'), value: eng ?? '-', desc: 'Interactions ÷ followers, per channel' },
    { id: 'interactions', label: tr('dInteractions'), value: compact(likes + comments + shares), desc: 'Interactions from posts published each day' },
  ];

  const pipe = [
    { label: tr('iDrafts'), value: drafts, color: C.faint },
    { label: 'Queued', value: queued, color: '#F2A400' },
    { label: 'Sent', value: sent.length, color: C.ink },
    { label: 'Failed', value: failed, color: '#E5484D' },
  ];

  const statusChip = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'sent': return { label: 'Sent', color: C.greenText };
      case 'partial': return { label: 'Partial', color: '#B45309' };
      case 'failed': return { label: 'Failed', color: C.redText };
      case 'publishing': return { label: 'Publishing', color: '#B45309' };
      case 'queued': return { label: 'Queued', color: '#B45309' };
      case 'approval': return { label: 'Review', color: '#7C5CF0' };
      default: return { label: 'Draft', color: C.muted };
    }
  };

  const glyphStack = (providers: string[], size: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {providers.slice(0, 3).map((pv, i) => (
        <View
          key={`${pv}-${i}`}
          style={{
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: SOCIAL_META[pv]?.bg ?? C.ink,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: C.card,
            marginLeft: i === 0 ? 0 : -size * 0.3,
            zIndex: providers.length - i,
          }}
        >
          <SocialGlyph platform={pv} size={size * 0.58} color="#fff" />
        </View>
      ))}
    </View>
  );

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
            <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
              <Tabs
                options={PRESETS.map((p) => ({ value: p.id, label: tr(p.key) }))}
                value={preset}
                onChange={setPreset}
                accessibilityLabel="Date range"
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
                const brand = SOCIAL_META[c.provider]?.bg ?? C.ink;
                const name = c.display_name?.trim() || SOCIAL_META[c.provider]?.label || c.provider;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setChanSel((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                    style={[s.chanChip, on && { backgroundColor: C.ink, borderColor: C.ink }]}
                    activeOpacity={0.75}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: brand, alignItems: 'center', justifyContent: 'center' }}>
                      <SocialGlyph platform={c.provider} size={12} color="#fff" />
                    </View>
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
                  <Text style={s.emptyS}>Connect a channel and publish, audience and engagement land here within a day.</Text>
                  <TouchableOpacity onPress={onConnect} style={s.connectBtn} activeOpacity={0.8}>
                    <Text style={s.connectBtnT}>{tr('iConnect')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Hero: four numbers as tabs over one chart (web parity). */}
                <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
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
                      <Text style={s.secS}>{metricCells.find((m) => m.id === metric)?.desc} · {range.label.toLowerCase()}</Text>
                      <View style={{ marginTop: 12 }}>
                        {metric === 'posts' || metric === 'interactions' ? (
                          <BarsChart
                            data={series.map((b) => b.value)}
                            color={C.accent}
                            height={120}
                            gridLines={3}
                            labels={series.map((b, i) => (i % Math.max(1, Math.ceil(series.length / 6)) === 0 ? b.label : ''))}
                            formatValue={(v) => compact(v)}
                          />
                        ) : (
                          <HBarList
                            rows={perfRows
                              .map((r) => ({
                                label: r.label,
                                value: metric === 'followers' ? r.followers ?? 0 : r.followers ? ((r.likes + r.comments + r.shares) / r.followers) * 100 : 0,
                                color: SOCIAL_META[r.channel.provider]?.bg ?? C.accent,
                              }))
                              .sort((a, b) => b.value - a.value)}
                            max={Math.max(
                              1,
                              ...perfRows.map((r) =>
                                metric === 'followers' ? r.followers ?? 0 : r.followers ? ((r.likes + r.comments + r.shares) / r.followers) * 100 : 0,
                              ),
                            )}
                            formatValue={(v) => (metric === 'engagement' ? `${v.toFixed(1)}%` : full(v))}
                          />
                        )}
                      </View>
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
                          {glyphStack(p.providers, 28)}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.postT} numberOfLines={1}>{p.title || 'Untitled post'}</Text>
                            <View style={s.metaRow}>
                              <Text style={s.postS}>{fmtDate(p.sentAt)}</Text>
                              <Stat icon="heart-outline" v={p.likes} C={C} />
                              <Stat icon="chatbubble-outline" v={p.comments} C={C} />
                              <Stat icon="repeat" v={p.shares} C={C} />
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
                          { value: 'weeks', label: 'Weeks' },
                          { value: 'weekdays', label: 'Weekdays' },
                        ]}
                      />
                    </View>
                    <Text style={[s.secS, { marginTop: 6 }]}>
                      {rhythm === 'weeks' ? `Sends per week · best ${weekMax}/wk` : 'When your posts actually go out'}
                    </Text>
                    <View style={{ marginTop: 12 }}>
                      <BarsChart
                        data={rhythm === 'weeks' ? weeks.map((w) => w.count) : weekdayCounts}
                        color={C.accent}
                        height={110}
                        gridLines={3}
                        labels={rhythm === 'weeks' ? weeks.map((w) => w.label) : WEEKDAYS}
                        formatValue={(v) => String(Math.round(v))}
                      />
                    </View>
                  </View>
                </View>

                {/* Channels */}
                <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                  <Text style={s.secT}>{tr('iChannels')}</Text>
                  <Text style={s.secS}>Followers refresh daily · engagement is interactions ÷ followers</Text>
                  {perfRows.length === 0 ? (
                    <Text style={s.hint}>Connect a channel and publish, audience and engagement land here within a day.</Text>
                  ) : (
                    <View style={[s.card, { marginTop: 10, paddingVertical: 4 }]}>
                      {perfRows.map((r, i) => (
                        <View key={r.channel.id} style={[s.rankRow, i > 0 && s.divider]}>
                          <View style={[s.brandTile, { backgroundColor: SOCIAL_META[r.channel.provider]?.bg ?? C.ink }]}>
                            <SocialGlyph platform={r.channel.provider} size={16} color="#fff" />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.postT} numberOfLines={1}>{r.label}</Text>
                            <View style={s.metaRow}>
                              <Text style={s.postS}>{r.eng ?? '-'} eng · {r.sent} sent</Text>
                              <Stat icon="heart-outline" v={r.likes} C={C} />
                              <Stat icon="chatbubble-outline" v={r.comments} C={C} />
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.postInter}>{compact(r.followers)}</Text>
                            <Text style={s.postS}>followers</Text>
                          </View>
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
                            {glyphStack([...new Set(p.targets.map((t) => t.provider))], 26)}
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.postT} numberOfLines={1}>
                                {p.title || p.body || (requiresTitle(p.targets.map((t) => t.provider)) ? 'Untitled post' : '')}
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
      </ScrollView>
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
