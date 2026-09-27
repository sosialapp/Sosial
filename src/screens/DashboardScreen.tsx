import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, T, R } from '../theme';
import { AvatarButton } from '../components/ProfileMenu';
import ConnectButton from '../components/ConnectButton';
import { loadManagedPosts, ManagedPost } from '../utils/managed';
import { loadMetaState } from '../utils/metaStore';
import { accountsFromMeta, PROVIDER_KEYS } from '../utils/socialAccounts';
import { fetchAnalytics } from '../utils/analytics';
import { fmtDateTime, platformsLabel } from '../utils/reminders';

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

export default function DashboardScreen({ team, email, onProfile, onConnect, onPost, onAnalytics }: {
  team: string;
  email: string;
  onProfile: () => void;
  onConnect: () => void;
  onPost: () => void;
  onAnalytics: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [channels, setChannels] = useState(0);
  const [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [list, meta] = await Promise.all([loadManagedPosts(), loadMetaState()]);
      setPosts(list);
      const accts = accountsFromMeta(meta);
      setChannels(accts.length);
      setConnected(accts.length > 0);
      // Analytics snapshot (last 7 days) — only when channels exist; the
      // full screen owns ranges, trends and per-channel detail.
      if (accts.length > 0) {
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
  const queued = posts.filter((p) => p.status === 'queued');
  const sentWeek = posts.filter((p) => p.status === 'sent' && (p.sentAt ?? 0) >= weekAgo);
  const upcoming = queued
    .filter((p) => p.scheduledAt)
    .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0))
    .slice(0, 3);
  const recent = posts
    .filter((p) => p.status === 'sent' && p.sentAt)
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
    .slice(0, 3);

  const tiles = [
    { label: 'Total Posts', value: String(posts.length), tint: '#1d7fe0', icon: 'bar-chart' },
    { label: 'Sent this week', value: String(sentWeek.length), tint: '#12914a', icon: 'send' },
    { label: 'Scheduled', value: String(queued.length), tint: '#7c5cf0', icon: 'time' },
    { label: 'Channels live', value: `${channels}/${PROVIDER_KEYS.length}`, tint: '#E1306C', icon: 'link' },
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
            <Text style={s.wordmark} numberOfLines={1}>{team || 'My team'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ConnectButton onPress={onConnect} />
            <AvatarButton email={email} team={team} onPress={onProfile} />
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
            <View key={t.label} style={s.tile}>
              <View style={[s.tileIcon, { backgroundColor: `${t.tint}1A` }]}>
                <Ionicons name={t.icon as any} size={16} color={t.tint} />
              </View>
              <Text style={s.tileV}>{t.value}</Text>
              <Text style={s.tileL}>{t.label}</Text>
            </View>
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
        {upcoming.length > 0 ? (
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <View style={s.secHead}>
              <Text style={s.secT}>Up next</Text>
              <Text style={s.secCount}>{String(queued.length).padStart(2, '0')}</Text>
            </View>
            <View>
              {upcoming.map((u) => (
                <TouchableOpacity key={u.id} onPress={onPost} style={s.row} activeOpacity={0.7}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.rowT} numberOfLines={1}>{u.title || 'Untitled'}</Text>
                    <Text style={s.rowS} numberOfLines={1}>
                      {u.scheduledAt ? fmtDateTime(u.scheduledAt) : ''} · {platformsLabel(u.platforms ?? ['any'])}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* recent activity */}
        {recent.length > 0 ? (
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <View style={s.secHead}>
              <Text style={s.secT}>Recent activity</Text>
            </View>
            <View>
              {recent.map((p) => (
                <TouchableOpacity key={p.id} onPress={onPost} style={s.row} activeOpacity={0.7}>
                  <View style={[s.sentDot, { backgroundColor: '#12914a' }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.rowT} numberOfLines={1}>{p.title || 'Untitled'}</Text>
                    <Text style={s.rowS} numberOfLines={1}>
                      Posted {p.sentAt ? timeAgo(p.sentAt) : ''} · {platformsLabel(p.platforms ?? ['any'])}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </TouchableOpacity>
              ))}
            </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, letterSpacing: -0.2, color: C.ink },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted },
  sentDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
