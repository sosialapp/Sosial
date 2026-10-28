import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, T } from '../theme';
import NotificationBell from '../components/NotificationBell';
import { useTourTarget } from '../components/Tour';
import { SocialGlyph } from '../components/ui';
import ConnectButton from '../components/ConnectButton';
import { loadManagedPosts, onManagedPostsChanged, ManagedPost } from '../utils/managed';
import { loadMetaState, connectedChannelIds, loadAccounts } from '../utils/metaStore';
import { PROVIDER_KEYS, schedulableProviders } from '../utils/socialAccounts';
import { fetchAnalytics } from '../utils/analytics';
import { fmtDateTime, platformsLabel } from '../utils/reminders';
import { requiresTitle, SOCIAL_META } from '../constants';
import { supabase, currentSession, isSupabaseConfigured } from '../utils/supabase';
import { tr, activeLocale } from '../i18n';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return tr('dLate');
  if (h < 12) return tr('dMorning');
  if (h < 18) return tr('dAfternoon');
  return tr('dEvening');
}

function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 3600000) return `${Math.max(1, Math.round(d / 60000))}m ago`;
  if (d < 86400000) return `${Math.round(d / 3600000)}h ago`;
  return `${Math.round(d / 86400000)}d ago`;
}

interface Summary { followers: number; engagement: number; hasFollowers: boolean }

/** Cloud mirror of the web dashboard's numbers (same queries, same
 *  definitions) so the tiles read the SAME value on every platform.
 *  Null when signed out or offline, tiles fall back to device-local. */
interface CloudTiles {
  total: number;
  sentWeek: number;
  scheduled: number;
  channelsLive: number;
  channelsTotal: number;
  upcoming: { id: string; title: string; providers: string[]; at: number }[];
  recent: { id: string; title: string; providers: string[]; at: number }[];
}

interface CloudDashPost {
  id: string;
  title: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  chain_id: string | null;
  chain_position: number | null;
  post_targets: { provider: string }[] | null;
}

/** Web parity (apps/web/src/lib/chains.ts): threads read as ONE post -
 *  head = lowest chain_position. */
function isChainHead(p: CloudDashPost): boolean {
  return !p.chain_id || (p.chain_position ?? 0) === 0;
}

async function loadCloudTiles(): Promise<CloudTiles | null> {
  try {
    if (!isSupabaseConfigured()) return null;
    const session = await currentSession().catch(() => null);
    if (!session) return null;
    const sb = supabase();
    const wsId = session.workspace.id;
    const [{ data: posts }, { data: chans }] = await Promise.all([
      sb
        .from('posts')
        .select('id, title, status, scheduled_at, sent_at, chain_id, chain_position, post_targets(provider)')
        .eq('workspace_id', wsId),
      sb.from('connected_channels').select('id, status').eq('workspace_id', wsId),
    ]);
    if (!posts) return null;
    const rows = posts as CloudDashPost[];
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const sent = rows.filter((p) => p.status === 'sent' || p.status === 'partial');
    const queuedHeads = rows.filter(
      (p) => (p.status === 'queued' || p.status === 'publishing') && isChainHead(p),
    );
    const chanRows = (chans ?? []) as { id: string; status: string }[];
    const providersOf = (p: CloudDashPost): string[] => [
      ...new Set((p.post_targets ?? []).map((t) => String(t.provider)).filter(Boolean)),
    ];
    const upcoming = queuedHeads
      .filter((p) => p.scheduled_at)
      .sort((a, b) => Date.parse(a.scheduled_at ?? '') - Date.parse(b.scheduled_at ?? ''))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        title: p.title ?? '',
        providers: providersOf(p),
        at: Date.parse(p.scheduled_at ?? ''),
      }));
    const recent = sent
      .filter((p) => p.sent_at)
      .sort((a, b) => Date.parse(b.sent_at ?? '') - Date.parse(a.sent_at ?? ''))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        title: p.title ?? '',
        providers: providersOf(p),
        at: Date.parse(p.sent_at ?? ''),
      }));
    return {
      total: rows.length,
      sentWeek: sent.filter((p) => p.sent_at && Date.parse(p.sent_at) >= weekAgo).length,
      scheduled: queuedHeads.length,
      channelsLive: chanRows.filter((c) => c.status === 'connected').length,
      channelsTotal: chanRows.length,
      upcoming,
      recent,
    };
  } catch {
    return null;
  }
}

export default function DashboardScreen({ team, onConnect, onPost, onAnalytics }: {
  team: string;
  onConnect: () => void;
  onPost: () => void;
  onAnalytics: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const tourKpis = useTourTarget('tour-home-kpis', { radius: 22 });
  const tourInsights = useTourTarget('tour-home-insights', { radius: 22 });
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [channels, setChannels] = useState(0);
  const [connected, setConnected] = useState(false);
  const [cloud, setCloud] = useState<CloudTiles | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [list, meta, ct] = await Promise.all([
        loadManagedPosts(),
        loadMetaState(),
        loadCloudTiles(),
      ]);
      setPosts(list);
      // Cloud tiles carry the SAME numbers the web dashboard computes from
      // the DB; device-local rows are the signed-out fallback.
      setCloud(ct);
      // Publishable channels only, same truth as the pill and the composer.
      // Cloud-only placeholders count: the worker publishes for them even
      // though this device holds no tokens.
      const accounts = await loadAccounts().catch(() => []);
      const live = [...new Set([...connectedChannelIds(meta), ...schedulableProviders(accounts)])];
      setChannels(ct ? ct.channelsLive : live.length);
      setConnected(ct ? ct.channelsLive > 0 : live.length > 0);
      // Analytics snapshot (last 7 days), only when channels exist; the
      // full screen owns ranges, trends and per-channel detail.
      if (live.length > 0) {
        try {
          const a = await fetchAnalytics(meta, 'last7');
          const followers = a.channels.reduce((n, c) => n + (c.followers ?? 0), 0);
          const hasFollowers = a.channels.some((c) => c.followers !== null);
          const engagement = a.channels.reduce(
            (n, c) => n + c.reactions + c.comments + (c.shares ?? 0), 0,
          );
          setSummary({ followers, engagement, hasFollowers });
        } catch {
          setSummary(null);
        }
      } else {
        setSummary(null);
      }
    } catch {
      /* storage reads are best-effort; the screen still renders */
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // Web posts adopted after the first paint (and any local save) land here
    // without a remount.
    return onManagedPostsChanged(() => {
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  // Cloud numbers first (web parity); device-local rows as the fallback.
  const queued = posts.filter((p) => p.status === 'queued');
  const sentWeekLocal = posts.filter((p) => p.status === 'sent' && (p.sentAt ?? 0) >= weekAgo);
  const upcomingLocal = queued
    .filter((p) => p.scheduledAt)
    .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0))
    .slice(0, 3);
  const recentLocal = posts
    .filter((p) => p.status === 'sent' && p.sentAt)
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
    .slice(0, 3);

  const kpis = [
    { label: tr('dSentWeek'), value: String(cloud ? cloud.sentWeek : sentWeekLocal.length), icon: 'paper-plane-outline' },
    { label: tr('dScheduled'), value: String(cloud ? cloud.scheduled : queued.length), icon: 'time-outline' },
    { label: tr('dTotal'), value: String(cloud ? cloud.total : posts.length), icon: 'bar-chart-outline' },
    { label: tr('dLive'), value: `${cloud ? cloud.channelsLive : channels}/${cloud ? cloud.channelsTotal : PROVIDER_KEYS.length}`, icon: 'link-outline' },
  ];
  const upcomingRows = cloud
    ? cloud.upcoming.map((u) => ({ key: u.id, title: u.title, providers: u.providers, at: u.at }))
    : upcomingLocal.map((u) => ({ key: u.id, title: u.title || u.body, providers: u.platforms ?? [], at: u.scheduledAt ?? 0 }));
  const recentRows = cloud
    ? cloud.recent.map((p) => ({ key: p.id, title: p.title, providers: p.providers, at: p.at }))
    : recentLocal.map((p) => ({ key: p.id, title: p.title || p.body, providers: p.platforms ?? [], at: p.sentAt ?? 0 }));
  const today = new Date().toLocaleDateString(activeLocale(), { weekday: 'long', month: 'long', day: 'numeric' });

  /** One post line: channel logos, the text, and when. */
  const postLine = (r: { key: string; title: string; providers: string[]; at: number }, i: number, when: string) => (
    <TouchableOpacity key={r.key} onPress={onPost} activeOpacity={0.75} style={[s.line, i > 0 && s.lineDivider]}>
      <View style={{ flexDirection: 'row' }}>
        {(r.providers.length ? r.providers : ['any']).slice(0, 3).map((pv, j) => (
          <View
            key={pv + j}
            style={[s.logo, { backgroundColor: SOCIAL_META[pv]?.bg ?? C.surface, marginLeft: j ? -10 : 0, zIndex: 3 - j }]}
          >
            {SOCIAL_META[pv] ? <SocialGlyph platform={pv} size={13} color="#fff" /> : <Ionicons name="globe-outline" size={13} color={C.muted} />}
          </View>
        ))}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.lineT} numberOfLines={1}>
          {r.title || (requiresTitle(r.providers) ? 'Untitled' : platformsLabel(r.providers.length ? r.providers : ['any']))}
        </Text>
        <Text style={s.lineS} numberOfLines={1}>{platformsLabel(r.providers.length ? r.providers : ['any'])}</Text>
      </View>
      <Text style={s.lineWhen} numberOfLines={1}>{when}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 116 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* masthead */}
        <View style={s.masthead}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../../assets/bolt.png')} style={{ width: 22, height: 28 }} resizeMode="contain" />
            <Text style={s.wordmark}>Sosial</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ConnectButton onPress={onConnect} />
            <NotificationBell />
          </View>
        </View>

        {/* date + greeting */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <Text style={s.date}>{today}</Text>
          <Text style={[T.h1, { color: C.ink, fontSize: 28, lineHeight: 34, marginTop: 2 }]}>
            {greeting()}, {team || tr('dCreator')}
          </Text>
        </View>

        {/* KPIs: one card, four cells split by hairlines */}
        <View style={[s.card, s.kpiCard]} ref={tourKpis} collapsable={false}>
          {kpis.map((k, i) => (
            <View
              key={k.label}
              style={[
                s.kpi,
                i % 2 === 1 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: C.line },
                i > 1 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name={k.icon as any} size={13} color={C.muted} />
                <Text style={s.kpiL} numberOfLines={1}>{k.label}</Text>
              </View>
              <Text style={s.kpiV}>{k.value}</Text>
            </View>
          ))}
        </View>

        {/* analytics snapshot */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <TouchableOpacity ref={tourInsights} onPress={connected ? onAnalytics : onConnect} style={s.card} activeOpacity={0.85}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.anIcon}><Ionicons name="analytics" size={16} color="#0b1220" /></View>
                <Text style={s.cardT}>{tr('dAnalytics')}</Text>
                <Text style={s.cardMeta}>{tr('dLast7')}</Text>
              </View>
              {statsLoading ? <ActivityIndicator size="small" color={C.accent} /> : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
            </View>
            {!statsLoading && !connected ? (
              <Text style={[s.lineS, { marginTop: 10 }]}>{tr('dConnectHint')}</Text>
            ) : summary ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <View style={s.anStat}>
                  <Text style={s.anV}>{summary.hasFollowers ? compact(summary.followers) : '-'}</Text>
                  <Text style={s.anL}>{tr('dFollowers')}</Text>
                </View>
                <View style={s.anStat}>
                  <Text style={s.anV}>{compact(summary.engagement)}</Text>
                  <Text style={s.anL}>{tr('dInteractions')}</Text>
                </View>
              </View>
            ) : !statsLoading ? (
              <Text style={[s.lineS, { marginTop: 10 }]}>{tr('dAnHint')}</Text>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* up next */}
        {upcomingRows.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
            <View style={s.secHead}>
              <Text style={s.secT}>{tr('dUpNext')}</Text>
              <Text style={s.secCount}>{tr('dQueued').replace('{n}', String(cloud ? cloud.scheduled : queued.length))}</Text>
            </View>
            <View style={[s.card, { paddingVertical: 4 }]}>
              {upcomingRows.map((r, i) => postLine(r, i, r.at ? fmtDateTime(r.at) : '-'))}
            </View>
          </View>
        ) : null}

        {/* recent activity */}
        {recentRows.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
            <View style={s.secHead}>
              <Text style={s.secT}>{tr('dRecent')}</Text>
            </View>
            <View style={[s.card, { paddingVertical: 4 }]}>
              {recentRows.map((r, i) => postLine(r, i, r.at ? timeAgo(r.at) : '-'))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 },
  wordmark: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, letterSpacing: -0.4, color: C.ink },
  date: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.muted },
  card: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.lineSoft, padding: 16 },
  kpiCard: { marginHorizontal: 20, marginTop: 18, padding: 0, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  kpi: { width: '50%', paddingHorizontal: 16, paddingVertical: 14 },
  kpiL: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted, flexShrink: 1 },
  kpiV: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, letterSpacing: -0.6, color: C.ink, marginTop: 6 },
  anIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  cardT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: C.ink },
  cardMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.faint },
  anStat: { flex: 1, backgroundColor: C.surface, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  anV: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, letterSpacing: -0.5, color: C.ink },
  anL: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.muted, marginTop: 2 },
  secHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  secT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.4, color: C.ink },
  secCount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  lineDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
  logo: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
  lineT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, letterSpacing: -0.2, color: C.ink },
  lineS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted },
  lineWhen: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted, maxWidth: 110, textAlign: 'right' },
});
