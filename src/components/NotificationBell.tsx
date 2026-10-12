import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R } from '../theme';
import { supabase } from '../utils/supabase';

export interface MobileNotif {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

function ago(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Notification bell — masthead slot where the avatar used to sit (web
 * NotificationBell parity). Polls `notifications` (RLS: own rows) every
 * 30s for the unread count, lists the latest in a sheet, marks all read
 * on open. Events are written by the P48/P60 DB triggers: team changes,
 * approvals and publish results.
 */
export default function NotificationBell() {
  const { C } = useTheme();
  const s = makeS(C);
  const [items, setItems] = useState<MobileNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase()
        .from('notifications')
        .select('id,kind,title,body,href,read_at,created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      const rows = (data ?? []) as MobileNotif[];
      setItems(rows);
      setUnread(rows.filter((r) => !r.read_at).length);
    } catch {
      // offline or signed out — keep the last list; next tick retries.
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
    const t = setInterval(() => void load(), 120000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      void load();
      if (unread > 0) {
        // Optimistic: clear the badge immediately, persist in background.
        setUnread(0);
        try {
          await supabase()
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .is('read_at', null);
        } catch {}
      }
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => void toggle()}
        style={s.btn}
        activeOpacity={0.8}
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Ionicons name="notifications-outline" size={20} color={C.ink} />
        {unread > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeT}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={s.bg}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.sheet}>
            <View style={s.head}>
              <Text style={s.title}>Notifications</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Close notifications">
                <Ionicons name="close-circle" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {loading && items.length === 0 ? (
                <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={C.accent} />
                </View>
              ) : items.length === 0 ? (
                <Text style={s.empty}>Nothing yet — publish results, approvals and team changes land here.</Text>
              ) : (
                items.map((n) => (
                  <View key={n.id} style={s.row}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={[s.rowT, !n.read_at && { color: C.ink, fontFamily: 'PlusJakartaSans_800ExtraBold' }]} numberOfLines={2}>
                          {n.title}
                        </Text>
                        <Text style={s.ago}>{ago(n.created_at)}</Text>
                      </View>
                      {n.body ? <Text style={s.rowS} numberOfLines={2}>{n.body}</Text> : null}
                    </View>
                    {!n.read_at ? <View style={s.dot} /> : null}
                  </View>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  btn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: '#fff' },
  bg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, maxHeight: '80%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
  empty: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 28, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.lineSoft },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, lineHeight: 18, color: C.muted, flex: 1 },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 17, color: C.muted },
  ago: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.faint },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginTop: 6 },
});
