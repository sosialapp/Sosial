import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { supabase, currentSession } from '../utils/supabase';

interface CalPost {
  id: string;
  title: string | null;
  body: string | null;
  status: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
}

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function monthMatrix(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(first);
  start.setDate(start.getDate() - offset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      week.push(d);
    }
    weeks.push(week);
  }
  return weeks;
}

const fmtTime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const fmtDay = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

function snippet(p: CalPost): string {
  const t = `${p.title ?? ''} ${p.body ?? ''}`.replace(/\s+/g, ' ').trim() || 'Untitled post';
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

/**
 * Schedule calendar — month grid plus the upcoming agenda, always visible
 * even with nothing scheduled. Read-only: scheduling itself stays in the
 * composer sheet, exactly like the web calendar's month view.
 */
export default function CalendarScreen() {
  const { C } = useTheme();
  const s = makeS(C);
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [signedIn, setSignedIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const session = await currentSession().catch(() => null);
      if (!session) {
        setSignedIn(false);
        setPosts([]);
        return;
      }
      setSignedIn(true);
      const sb = supabase();
      const { data } = await sb
        .from('posts')
        .select('id,title,body,status,scheduled_at,sent_at')
        .eq('workspace_id', session.workspace.id)
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .limit(200);
      setPosts(((data ?? []) as CalPost[]).filter((p) => p.scheduled_at));
    } catch {
      // stale list stays; the refresh spinner stops below
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalPost[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const k = dayKey(new Date(p.scheduled_at));
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [posts]);

  const agenda = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const out: { key: string; date: Date; items: CalPost[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const items = (byDay.get(dayKey(d)) ?? []).filter(
        (p) => p.status === 'queued' || p.status === 'publishing' || p.status === 'approval' || p.status === 'sent',
      );
      if (items.length) out.push({ key: dayKey(d), date: d, items });
    }
    return out;
  }, [byDay]);

  const weeks = useMemo(() => monthMatrix(anchor), [anchor]);
  const today = new Date();
  const shiftMonth = (n: number) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
    setAnchor(d);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={C.muted} />}
      >
        <Text style={s.kicker}>Calendar</Text>
        <View style={s.titleRow}>
          <Text style={[T.h1, { color: C.ink, fontSize: 30, lineHeight: 36 }]}>
            {anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={s.navBtn} activeOpacity={0.7} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={18} color={C.ink} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { const n = new Date(); setAnchor(n); setSelectedKey(dayKey(n)); }} style={s.todayBtn} activeOpacity={0.7}>
            <Text style={s.todayT}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={s.navBtn} activeOpacity={0.7} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={18} color={C.ink} />
          </TouchableOpacity>
        </View>

        {!signedIn ? (
          <View style={s.note}>
            <Text style={s.noteT}>Sign in to Sosial Cloud to see scheduled posts here.</Text>
          </View>
        ) : null}

        <View style={s.grid}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
            <Text key={d} style={s.dow}>{d}</Text>
          ))}
          {weeks.flat().map((day) => {
            const k = dayKey(day);
            const count = byDay.get(k)?.length ?? 0;
            const inMonth = day.getMonth() === anchor.getMonth();
            const isToday = dayKey(day) === dayKey(today);
            const isSel = selectedKey === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setSelectedKey(k)}
                style={[s.cell, isSel && s.cellSel, !inMonth && s.cellDim]}
                activeOpacity={0.7}
              >
                <View style={[s.num, isToday && s.numToday]}>
                  <Text style={[s.numT, isToday && s.numTToday]}>{day.getDate()}</Text>
                </View>
                {count > 0 ? (
                  <View style={s.dots}>
                    {[0, 1, 2].slice(0, Math.min(3, count)).map((i) => (
                      <View key={i} style={s.dot} />
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[T.h2, { color: C.ink, marginTop: 22 }]}>Upcoming</Text>
        {loading ? (
          <ActivityIndicator size="small" color={C.muted} style={{ marginTop: 16 }} />
        ) : agenda.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyT}>Nothing scheduled</Text>
            <Text style={s.emptyS}>Queue a post and it lands here with its exact time.</Text>
          </View>
        ) : (
          agenda.map((day) => (
            <View key={day.key} style={{ marginTop: 14 }}>
              <TouchableOpacity onPress={() => setSelectedKey(day.key)} activeOpacity={0.7}>
                <Text style={s.dayT}>
                  {fmtDay(day.date)}
                  <Text style={s.dayC}> · {day.items.length} post{day.items.length === 1 ? '' : 's'}</Text>
                </Text>
              </TouchableOpacity>
              {day.items.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedKey(day.key)}
                  style={s.row}
                  activeOpacity={0.75}
                >
                  <Text style={s.time}>{fmtTime(p.scheduled_at)}</Text>
                  <Text style={s.rowT} numberOfLines={1}>{snippet(p)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  kicker: { ...T.tag, color: C.accent, marginTop: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  todayBtn: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  todayT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.ink },
  note: { backgroundColor: C.card, borderRadius: R.lg, padding: 14, marginTop: 16 },
  noteT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.card, borderRadius: R.lg, overflow: 'hidden', marginTop: 16, paddingVertical: 6 },
  dow: { width: '14.28%', textAlign: 'center', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.muted, paddingVertical: 6 },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 7, borderRadius: 12 },
  cellSel: { backgroundColor: C.accentSoft },
  cellDim: { opacity: 0.4 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numToday: { backgroundColor: C.accent },
  numT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.ink },
  numTToday: { color: C.onInk },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  empty: { backgroundColor: C.card, borderRadius: R.lg, padding: 18, marginTop: 12, alignItems: 'center' },
  emptyT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  emptyS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 6, textAlign: 'center' },
  dayT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink },
  dayC: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 11, marginTop: 7 },
  time: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.accentInk, minWidth: 64 },
  rowT: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, color: C.soft },
});
