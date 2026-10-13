import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, T, R } from '../theme';
import NotificationBell from '../components/NotificationBell';
import { Card, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui-kit';
import ConnectButton from '../components/ConnectButton';
import { loadManagedPosts, ManagedPost } from '../utils/managed';
import { loadMetaState, connectedChannelIds, loadAccounts } from '../utils/metaStore';
import { PROVIDER_KEYS, schedulableProviders } from '../utils/socialAccounts';
import { fetchAnalytics } from '../utils/analytics';
import { fmtDateTime, platformsLabel } from '../utils/reminders';
import { supabase, currentSession, isSupabaseConfigured } from '../utils/supabase';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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

  const tiles = [
    { label: 'Total Posts', value: String(cloud ? cloud.total : posts.length), tint: '#1d7fe0', icon: 'bar-chart' },
    { label: 'Sent this week', value: String(cloud ? cloud.sentWeek : sentWeekLocal.length), tint: '#12914a', icon: 'send' },
    { label: 'Scheduled', value: String(cloud ? cloud.scheduled : queued.length), tint: '#7c5cf0', icon: 'time' },
    { label: 'Channels live', value: `${cloud ? cloud.channelsLive : channels}/${cloud ? cloud.channelsTotal : PROVIDER_KEYS.length}`, tint: '#E1306C', icon: 'link' },
  ];

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
            <Text style={s.wordmark} numberOfLines={1}>Sosial</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ConnectButton onPress={onConnect} />
            <NotificationBell />
          </View>
        </View>

        {/* greeting */}
        <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
          <Text style={[T.h1, { color: C.ink, fontSize: 30, lineHeight: 36 }]}>
            {greeting()}, {team || 'creator'}
          </Text>
          <Text style={s.sub}>Here&apos;s what&apos;s happening with your content today.</Text>
          <TouchableOpacity onPress={onPost} style={s.cta} activeOpacity={0.88}>
            <Text style={s.ctaT}>+ New post</Text>
            <Ionicons name="arrow-forward" size={19} color={C.onInk} />
          </TouchableOpacity>
        </View>

        {/* stat tiles */}
        <View style={s.tiles}>
          {tiles.map((t) => (
            <Card key={t.label} style={s.tile}>
              <View style={[s.tileIcon, { backgroundColor: `${t.tint}1A` }]}>
                <Ionicons name={t.icon as any} size={16} color={t.tint} />
              </View>
              <Text style={s.tileV}>{t.value}</Text>
              <Text style={s.tileL}>{t.label}</Text>
            </Card>
          ))}
        </View>

        {/* analytics pill */}
        <View style={{ paddingHorizontal: 24, marginTop: 14 }}>
          <TouchableOpacity onPress={connected ? onAnalytics : onConnect} style={s.pill} activeOpacity={0.8}>
            <View style={[s.pillIcon, { backgroundColor: `${C.accent}22` }]}>
              <Ionicons name="analytics" size={18} color={C.accentInk} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.pillT}>Analytics</Text>
              {statsLoading ? (
                <Text style={s.pillS}>Loading last 7 days…</Text>
              ) : !connected ? (
                <Text style={s.pillS}>Connect channels to see stats</Text>
              ) : summary ? (
                <Text style={s.pillS} numberOfLines={1}>
                  {summary.hasFollowers ? `${compact(summary.followers)} followers · ` : ''}
                  {compact(summary.engagement)} engagement · 7d
                </Text>
              ) : (
                <Text style={s.pillS}>Followers, engagement, best time to post</Text>
              )}
            </View>
            {statsLoading ? (
              <ActivityIndicator size="small" color={C.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            )}
          </TouchableOpacity>
        </View>

        {/* up next */}
        {(cloud ? cloud.upcoming.length : upcomingLocal.length) > 0 ? (
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <View style={s.secHead}>
              <Text style={s.secT}>Up next</Text>
              <Text style={s.secCount}>{String(cloud ? cloud.scheduled : queued.length).padStart(2, '0')}</Text>
            </View>
            <Card style={{ marginTop: 12, padding: 0 }} padded={false}>
              <Table>
                <TableHeader>
                  <TableHead flex={3}>Post</TableHead>
                  <TableHead flex={2} align="right">When</TableHead>
                </TableHeader>
                <TableBody>
                  {(cloud
                    ? cloud.upcoming.map((u) => ({ key: u.id, title: u.title, sub: platformsLabel(u.providers.length ? u.providers : ['any']), when: u.at }))
                    : upcomingLocal.map((u) => ({ key: u.id, title: u.title || 'Untitled', sub: platformsLabel(u.platforms ?? ['any']), when: u.scheduledAt ?? 0 }))
                  ).map((u, i, all) => (
                    <TableRow key={u.key} last={i === all.length - 1} onPress={onPost}>
                      <TableCell flex={3}>
                        <Text style={s.rowT} numberOfLines={1}>{u.title || 'Untitled'}</Text>
                        <Text style={s.rowS} numberOfLines={1}>{u.sub}</Text>
                      </TableCell>
                      <TableCell flex={2} align="right">
                        <Text style={s.rowS} numberOfLines={1}>{u.when ? fmtDateTime(u.when) : '-'}</Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </View>
        ) : null}

        {/* recent activity */}
        {(cloud ? cloud.recent.length : recentLocal.length) > 0 ? (
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <View style={s.secHead}>
              <Text style={s.secT}>Recent activity</Text>
            </View>
            <Card style={{ marginTop: 12, padding: 0 }} padded={false}>
              <Table>
                <TableHeader>
                  <TableHead flex={3}>Post</TableHead>
                  <TableHead flex={2} align="right">Sent</TableHead>
                </TableHeader>
                <TableBody>
                  {(cloud
                    ? cloud.recent.map((p) => ({ key: p.id, title: p.title || 'Untitled', sub: platformsLabel(p.providers.length ? p.providers : ['any']), at: p.at }))
                    : recentLocal.map((p) => ({ key: p.id, title: p.title || 'Untitled', sub: platformsLabel(p.platforms ?? ['any']), at: p.sentAt ?? 0 }))
                  ).map((p, i, all) => (
                    <TableRow key={p.key} last={i === all.length - 1} onPress={onPost}>
                      <TableCell flex={3}>
                        <Text style={s.rowT} numberOfLines={1}>{p.title || 'Untitled'}</Text>
                        <Text style={s.rowS} numberOfLines={1}>{p.sub}</Text>
                      </TableCell>
                      <TableCell flex={2} align="right">
                        <Text style={s.rowS} numberOfLines={1}>{p.at ? timeAgo(p.at) : '-'}</Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 },
  wordmark: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, letterSpacing: -0.4, color: C.ink, maxWidth: 150 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, lineHeight: 20, color: C.muted, marginTop: 6 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.accent, borderRadius: R.md + 2, paddingVertical: 15, paddingHorizontal: 20, marginTop: 16 },
  ctaT: { fontFamily: 'PlusJakartaSans_700Bold', color: C.onInk, fontSize: 15 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, marginTop: 18 },
  tile: { flexBasis: '48%', flexGrow: 1, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, padding: 14 },
  tileIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tileV: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, letterSpacing: -0.5, color: C.ink, marginTop: 10 },
  tileL: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: R.md + 2, borderWidth: 1, borderColor: C.lineSoft, paddingVertical: 14, paddingHorizontal: 16 },
  pillIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pillT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, letterSpacing: -0.2, color: C.ink },
  pillS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted },
  secHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 10 },
  secT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, letterSpacing: -0.4, color: C.ink },
  secCount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.accent },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, letterSpacing: -0.2, color: C.ink },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted },
});
