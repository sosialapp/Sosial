import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R } from '../theme';
import { supabase } from '../utils/supabase';

export interface MobileNotif {
  id: string;
  source: 'notification' | 'announcement';
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
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
 * Notification bell, masthead slot where the avatar used to sit (web
 * NotificationBell parity). Polls `notifications` (RLS: own rows) and
 * app-wide `announcements` (P75, filtered to this platform) every 120s,
 * merges them newest-first, and lists the latest in a sheet; opening marks
 * everything read. Event rows come from P48/P60 DB triggers; announcements
 * keep their own read state in `announcement_reads`.
 */
export default function NotificationBell() {
  const { C } = useTheme();
  const s = makeS(C);
  const [items, setItems] = useState<MobileNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const sb = supabase();
      const [notifs, anns, reads] = await Promise.all([
        sb
          .from('notifications')
          .select('id,kind,title,body,href,read_at,created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        sb
          .from('announcements')
          .select('id,kind,title,body,href,created_at')
          .overlaps('platforms', [Platform.OS])
          .order('created_at', { ascending: false })
          .limit(20),
        sb.from('announcement_reads').select('announcement_id, dismissed_at'),
      ]);
      const readRows = (reads.data ?? []) as { announcement_id: string; dismissed_at: string | null }[];
      const readIds = new Set(readRows.map((r) => r.announcement_id));
      const dismissed = new Set(readRows.filter((r) => r.dismissed_at).map((r) => r.announcement_id));
      const merged: MobileNotif[] = [
        ...((notifs.data ?? []) as { id: string; kind: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string }[]).map(
          (n) => ({ ...n, source: 'notification' as const, read: !!n.read_at }),
        ),
        ...((anns.data ?? []) as { id: string; kind: string; title: string; body: string; href: string | null; created_at: string }[])
          .filter((a) => !dismissed.has(a.id))
          .map((a) => ({ ...a, source: 'announcement' as const, read: readIds.has(a.id) })),
      ]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 20);
      setItems(merged);
      setUnread(merged.filter((r) => !r.read).length);
    } catch {
      // offline or signed out, keep the last list; next tick retries.
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
    const t = setInterval(() => void load(), 120000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) {
      setConfirmAll(false);
      return;
    }
    void load();
    if (unread === 0) return;
    // Optimistic: clear the badge and the unread styling immediately.
    setUnread(0);
    setItems((prev) => prev.map((r) => ({ ...r, read: true })));
    try {
      const sb = supabase();
      await sb
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      const unreadAnn = items
        .filter((n) => n.source === 'announcement' && !n.read)
        .map((n) => n.id);
      if (unreadAnn.length) {
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (user) {
          await sb.from('announcement_reads').upsert(
            unreadAnn.map((id) => ({ announcement_id: id, user_id: user.id })),
            { onConflict: 'announcement_id,user_id' },
          );
        }
      }
    } catch {}
  };

  /** Delete one row: notifications are per-recipient rows (hard delete);
   *  announcements are app-wide, so they are dismissed per user instead. */
  const remove = async (n: MobileNotif) => {
    if (deleting) return;
    setDeleting(`${n.source}-${n.id}`);
    const wasUnread = !n.read;
    setItems((prev) => prev.filter((x) => !(x.source === n.source && x.id === n.id)));
    setUnread((prev) => Math.max(0, prev - (wasUnread ? 1 : 0)));
    try {
      const sb = supabase();
      if (n.source === 'notification') {
        await sb.from('notifications').delete().eq('id', n.id);
      } else {
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (user) {
          await sb.from('announcement_reads').upsert(
            { announcement_id: n.id, user_id: user.id, dismissed_at: new Date().toISOString() },
            { onConflict: 'announcement_id,user_id' },
          );
        }
      }
    } catch {
      void load();
    } finally {
      setDeleting(null);
    }
  };

  /**
   * Clear the whole bell. Two taps, because it is irreversible: the first
   * arms the button for four seconds, the second deletes. Notifications are
   * this user's own rows (hard delete); announcements are app-wide, so the
   * visible ones are dismissed per user, same as the single-row path.
   */
  const removeAll = async () => {
    if (deleting || items.length === 0) return;
    if (!confirmAll) {
      setConfirmAll(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmAll(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmAll(false);

    const snapshot = items;
    setDeleting('all');
    setItems([]);
    setUnread(0);

    try {
      const sb = supabase();
      await sb.from('notifications').delete().not('id', 'is', null);
      const annIds = snapshot.filter((n) => n.source === 'announcement').map((n) => n.id);
      if (annIds.length) {
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (user) {
          await sb.from('announcement_reads').upsert(
            annIds.map((id) => ({
              announcement_id: id,
              user_id: user.id,
              dismissed_at: new Date().toISOString(),
            })),
            { onConflict: 'announcement_id,user_id' },
          );
        }
      }
    } catch {
      void load();
    } finally {
      setDeleting(null);
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
        {/* Backdrop is a sibling, not a wrapper: a touchable around the list
            swallows the drag and the ScrollView never scrolls. */}
        <View style={s.bg}>
          <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} accessibilityLabel="Close notifications" />
          <View style={s.sheet}>
            <View style={s.head}>
              <Text style={s.title}>Notifications</Text>
              <View style={s.headRight}>
                {items.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => void removeAll()}
                    disabled={deleting === 'all'}
                    hitSlop={8}
                    style={[s.clear, confirmAll && s.clearArmed]}
                    accessibilityLabel={confirmAll ? 'Confirm delete all notifications' : 'Delete all notifications'}
                  >
                    {deleting === 'all' ? (
                      <ActivityIndicator size="small" color={confirmAll ? '#fff' : C.faint} />
                    ) : (
                      <Ionicons name="trash-outline" size={13} color={confirmAll ? '#fff' : '#9F2F2D'} />
                    )}
                    <Text style={[s.clearT, confirmAll && { color: '#fff' }]}>
                      {deleting === 'all' ? 'Deleting' : confirmAll ? 'Delete all?' : 'Delete all'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Close notifications">
                  <Ionicons name="close-circle" size={24} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {loading && items.length === 0 ? (
                <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={C.accent} />
                </View>
              ) : items.length === 0 ? (
                <Text style={s.empty}>Nothing yet, announcements, publish results, approvals and team changes land here.</Text>
              ) : (
                items.map((n) => (
                  <View key={`${n.source}-${n.id}`} style={s.row}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={[s.rowT, !n.read && { color: C.ink, fontFamily: 'PlusJakartaSans_800ExtraBold' }]} numberOfLines={2}>
                          {n.title}
                        </Text>
                        <Text style={s.ago}>{ago(n.created_at)}</Text>
                      </View>
                      {n.body ? <Text style={s.rowS} numberOfLines={2}>{n.body}</Text> : null}
                    </View>
                    {!n.read ? <View style={s.dot} /> : null}
                    <TouchableOpacity
                      onPress={() => void remove(n)}
                      disabled={!!deleting}
                      hitSlop={10}
                      style={s.del}
                      accessibilityLabel={`Delete ${n.title}`}
                    >
                      {deleting === `${n.source}-${n.id}` ? (
                        <ActivityIndicator size="small" color={C.faint} />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color={C.faint} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
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
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  clearArmed: { backgroundColor: '#9F2F2D' },
  clearT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: '#9F2F2D' },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
  empty: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 28, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.lineSoft },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, lineHeight: 18, color: C.muted, flex: 1 },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 17, color: C.muted },
  ago: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.faint },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginTop: 6 },
  del: { padding: 2, marginTop: 2 },
});
