import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R } from '../theme';
import { avatarSignedUrl, currentSession, listMyWorkspaces, switchWorkspace, type WorkspaceSummary } from '../utils/supabase';

/**
 * Team switcher: "{avatar} {team} ⌄" opens a bottom sheet listing every
 * workspace this user belongs to. Used as the dropdown on the Team page
 * (`full`). Switching pins the workspace in SecureStore and hands off to the
 * app shell, which remounts every screen against the new workspace.
 */
export default function TeamSwitcher({
  team,
  onSwitched,
  onManage,
  full,
}: {
  team?: string;
  onSwitched: (ws: { id: string; name: string }) => void;
  onManage?: () => void;
  /** Full-width row trigger (Team page) instead of the masthead pill. */
  full?: boolean;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<WorkspaceSummary[]>([]);
  const [pics, setPics] = useState<Record<string, string>>({});
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const session = await currentSession();
      if (!session) return;
      setCurrentId(session.workspace.id);
      const list = await listMyWorkspaces(session.user.id);
      setTeams(list);
      // Team photos live in storage and need signing; the signed URLs are
      // cached by avatarSignedUrl so re-opening the sheet is instant.
      await Promise.all(
        list.filter((t) => t.avatarUrl && !pics[t.id]).map(async (t) => {
          const url = await avatarSignedUrl(t.avatarUrl!);
          if (url) setPics((prev) => ({ ...prev, [t.id]: url }));
        }),
      );
    } catch {
      /* offline, keep the last list; opening the sheet retries */
    }
  }, [pics]);

  const currentName = teams.find((t) => t.id === currentId)?.name ?? team ?? 'Team';

  const openSheet = () => {
    setOpen(true);
    if (teams.length === 0) {
      setLoading(true);
      void load().finally(() => setLoading(false));
    } else {
      void load();
    }
  };

  const pick = async (t: WorkspaceSummary) => {
    if (switching) return;
    if (t.id === currentId) {
      setOpen(false);
      return;
    }
    setSwitching(t.id);
    try {
      await switchWorkspace(t.id);
      setCurrentId(t.id);
      setOpen(false);
      onSwitched({ id: t.id, name: t.name });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Try again.';
      Alert.alert("Couldn't switch team", msg);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={openSheet}
        style={[s.pill, full && s.pillFull]}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${currentName}, switch team`}
      >
        <View style={[s.avatar, full && s.avatarFull]}>
          {pics[currentId ?? ''] ? (
            <Image source={{ uri: pics[currentId ?? ''] }} style={{ width: '100%', height: '100%', borderRadius: 999 }} />
          ) : (
            <Text style={s.avatarT}>{(currentName || 'T')[0].toUpperCase()}</Text>
          )}
        </View>
        <Text style={[s.pillT, full && s.pillTFlex]} numberOfLines={1}>{currentName}</Text>
        <Ionicons name="chevron-down" size={14} color={C.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={s.bg}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.sheet}>
            <View style={s.head}>
              <Text style={s.title}>Switch team</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Close team switcher">
                <Ionicons name="close-circle" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.accent} />
              </View>
            ) : teams.length === 0 ? (
              <Text style={s.empty}>No teams loaded. Refresh the app, then try again.</Text>
            ) : (
              <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
                {teams.map((t) => {
                  const current = t.id === currentId;
                  const busy = switching === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => void pick(t)}
                      disabled={!!switching}
                      activeOpacity={0.8}
                      style={[s.row, current && { backgroundColor: C.surface }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.name}${current ? ', current team' : ', switch team'}`}
                    >
                      <View style={[s.rowAvatar, current && { backgroundColor: C.ink }]}>
                        {pics[t.id] ? (
                          <Image source={{ uri: pics[t.id] }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                        ) : (
                          <Text style={[s.rowAvatarT, current && { color: C.onInk }]}>
                            {(t.name || 'T')[0].toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.rowT} numberOfLines={1}>{t.name}</Text>
                        <Text style={s.rowS} numberOfLines={1}>
                          {t.role} · {t.liveChannels} channel{t.liveChannels === 1 ? '' : 's'}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator size="small" color={C.muted} />
                      ) : current ? (
                        <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={C.faint} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {onManage ? (
              <TouchableOpacity
                onPress={() => {
                  setOpen(false);
                  onManage();
                }}
                style={s.manage}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Manage team"
              >
                <Ionicons name="people-outline" size={17} color={C.ink} />
                <Text style={s.manageT}>Manage team</Text>
                <Ionicons name="chevron-forward" size={15} color={C.faint} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 148,
    height: 36,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 18,
    backgroundColor: C.surface,
    flexShrink: 1,
  },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  avatarFull: { width: 34, height: 34, borderRadius: 17 },
  avatarT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: C.onInk },
  pillT: { flexShrink: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink, maxWidth: 92 },
  pillFull: {
    maxWidth: '100%',
    height: 52,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: R.md,
    alignSelf: 'stretch',
  },
  pillTFlex: { flex: 1, maxWidth: '100%', fontSize: 14 },
  bg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
  empty: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 28, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: R.md },
  rowAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.lineSoft, alignItems: 'center', justifyContent: 'center' },
  rowAvatarT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: C.ink },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingTop: 14,
    paddingHorizontal: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: C.lineSoft,
  },
  manageT: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
});
