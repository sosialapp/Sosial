import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { Txt, Field, ChannelAvatar } from '../components/ui';
import {
  loadTeam, addTeamMember, removeTeamMember, updateMember, memberChannelsLabel,
  assignableChannels, normalizeChannels, canRemoveMember, canAssignChannels, canChangeRole,
  loadActor, saveActor, saveTeam, TeamMember, Actor, AssignableChannel,
} from '../utils/team';
import { loadAccounts } from '../utils/metaStore';
import { ConnectedAccount } from '../utils/socialAccounts';

/**
 * Workspace roster: invite, roles (admin/member), per-channel assignment,
 * remove / step down / leave. Same permission model as the backend will
 * enforce; the roster itself still lives on this device until sync lands.
 *
 * Two doors lead here: the Team button on top of Connect, and Account → Team.
 */
export default function TeamScreen({ plan, email, teamName, onBack, onSeePlans }: {
  plan: 'free' | 'pro' | 'team';
  email: string;
  teamName: string;
  onBack: () => void;
  onSeePlans: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [mName, setMName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mChannels, setMChannels] = useState<string[]>(['all']);
  const [chanList, setChanList] = useState<AssignableChannel[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [actingAs, setActingAs] = useState<string>('owner');
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const accts = await loadAccounts();
      setAccounts(accts);
      setChanList(assignableChannels(accts));
      const team = await loadTeam();
      let changed = false;
      const normalized = team.map((m) => {
        const next = normalizeChannels(m.channels, accts);
        if (next.join(',') !== m.channels.join(',')) { changed = true; return { ...m, channels: next }; }
        return m;
      });
      setMembers(changed ? await saveTeam(normalized) : team);
      setActingAs((await loadActor()).id ?? 'owner');
    })();
  }, []);

  const actor: Actor = actingAs === 'owner'
    ? { id: null, role: 'owner' }
    : (() => {
        const m = members.find((x) => x.id === actingAs);
        return m ? { id: m.id, role: m.role } : { id: null, role: 'owner' as const };
      })();

  const changeActor = (id: string | null) => {
    setActingAs(id ?? 'owner');
    setAssigningId(null);
    void saveActor(id);
  };

  const toggleMChannel = (id: string) => {
    setMChannels((prev) => {
      if (id === 'all') return ['all'];
      const without = prev.filter((x) => x !== 'all' && x !== id);
      if (prev.includes(id)) return without.length ? without : ['all'];
      return [...without, id];
    });
  };

  const saveMember = async () => {
    if (!mEmail.trim()) {
      Alert.alert('Email needed', 'Add the teammate’s email so invites reach them.');
      return;
    }
    setMembers(await addTeamMember({ name: mName, email: mEmail, channels: mChannels }));
    setMName('');
    setMEmail('');
    setMChannels(['all']);
  };

  const resetActingIfGone = (id: string) => {
    if (actingAs === id) changeActor(null);
    if (assigningId === id) setAssigningId(null);
  };

  const dropMember = (m: TeamMember) => {
    Alert.alert('Remove teammate', `Remove ${m.name} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setMembers(await removeTeamMember(m.id));
        resetActingIfGone(m.id);
      } },
    ]);
  };

  const leaveTeam = (m: TeamMember) => {
    Alert.alert('Leave team?', 'You’ll lose access to these channels on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        setMembers(await removeTeamMember(m.id));
        resetActingIfGone(m.id);
      } },
    ]);
  };

  const stepDown = (m: TeamMember) => {
    Alert.alert('Step down?', `${m.name} will become a regular member.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Step down', onPress: async () => setMembers(await updateMember(m.id, { role: 'member' })) },
    ]);
  };

  const flipRole = async (m: TeamMember) => {
    const next = m.role === 'admin' ? 'member' : 'admin';
    setMembers(await updateMember(m.id, { role: next }));
  };

  const toggleMemberChannel = async (m: TeamMember, id: string) => {
    let next: string[];
    if (id === 'all') next = ['all'];
    else {
      const without = m.channels.filter((x) => x !== 'all' && x !== id);
      next = m.channels.includes(id) ? (without.length ? without : ['all']) : [...without, id];
    }
    setMembers(await updateMember(m.id, { channels: next }));
  };

  const initial = (email || teamName || 'Z')[0].toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.kicker}>Workspace</Text>
        <Text style={[T.h1, { color: C.ink, marginTop: 8, fontSize: 30, lineHeight: 36 }]}>Team</Text>
        {plan === 'team' ? (
          <Text style={s.sub}>
            {members.length === 0 ? 'Just you for now — invite the crew below.' : `${members.length} teammate${members.length === 1 ? '' : 's'} besides you.`}
          </Text>
        ) : null}

        {plan !== 'team' ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={s.empty}>
              <Text style={s.emptyT}>Team needs Sosial Team</Text>
              <Text style={s.emptyS}>The roster, roles and per-channel assignment unlock on the Team plan.</Text>
              <TouchableOpacity onPress={onSeePlans} style={[s.save, { marginTop: 12 }]} activeOpacity={0.85}>
                <Text style={s.saveT}>See plans</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 16, gap: 12 }}>
            <Text style={s.note}>Roster lives on this device for now — real invites and cross-device sync arrive with the backend.</Text>

            <Field label="Acting as" hint="Preview what each role can do.">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity onPress={() => changeActor(null)} style={[s.chan, actingAs === 'owner' && { backgroundColor: C.ink, borderColor: C.ink }]} activeOpacity={0.75}>
                  <Text style={[s.chanT, actingAs === 'owner' && { color: C.onInk }]}>Owner (you)</Text>
                </TouchableOpacity>
                {members.map((m) => (
                  <TouchableOpacity key={m.id} onPress={() => changeActor(m.id)} style={[s.chan, actingAs === m.id && { backgroundColor: C.ink, borderColor: C.ink }]} activeOpacity={0.75}>
                    <Text style={[s.chanT, actingAs === m.id && { color: C.onInk }]}>{m.name} · {m.role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <View style={s.head}>
              <View style={s.avatar}><Text style={s.avatarT}>{initial}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.email} numberOfLines={1}>{email || 'No email set'}</Text>
                <Text style={s.team} numberOfLines={1}>{teamName} · Owner</Text>
              </View>
            </View>

            {members.map((m) => {
              const isSelf = actor.id === m.id;
              const showRoleFlip = !isSelf && canChangeRole(actor, m, m.role === 'admin' ? 'member' : 'admin');
              const showChannels = !isSelf && canAssignChannels(actor, m);
              const showTrash = !isSelf && canRemoveMember(actor, m);
              return (
                <View key={m.id} style={s.member}>
                  <View style={s.miniAvatar}><Text style={s.miniAvatarT}>{(m.name || m.email || '?')[0].toUpperCase()}</Text></View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Text style={s.rowT} numberOfLines={1}>{m.name}</Text>
                      <View style={s.rolePill}><Text style={s.rolePillT}>{m.role}</Text></View>
                    </View>
                    <Text style={s.rowS} numberOfLines={1}>{m.email} · {memberChannelsLabel(m.channels, accounts)}</Text>
                    {showRoleFlip || showChannels || showTrash || (isSelf && actor.role !== 'owner') ? (
                      <View style={s.actions}>
                        {showRoleFlip ? (
                          <MiniBtn label={m.role === 'admin' ? 'Demote' : 'Make admin'} onPress={() => flipRole(m)} />
                        ) : null}
                        {showChannels ? (
                          <MiniBtn label={assigningId === m.id ? 'Done' : 'Assign channels'} onPress={() => setAssigningId(assigningId === m.id ? null : m.id)} />
                        ) : null}
                        {isSelf && actor.role === 'admin' ? (
                          <MiniBtn label="Step down" onPress={() => stepDown(m)} />
                        ) : null}
                        {isSelf && actor.role === 'member' ? (
                          <MiniBtn label="Leave team" danger onPress={() => leaveTeam(m)} />
                        ) : null}
                        {showTrash ? (
                          <MiniBtn label="Remove" danger onPress={() => dropMember(m)} />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {members.length === 0 ? (
              <Text style={s.hint}>No teammates yet — invite your first below.</Text>
            ) : null}
            {assigningId ? (
              (() => {
                const m = members.find((x) => x.id === assigningId);
                if (!m || !canAssignChannels(actor, m)) return null;
                return (
                  <View style={s.plan}>
                    <Text style={s.planT}>Channels for {m.name}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => toggleMemberChannel(m, 'all')}
                        style={[s.chan, m.channels.includes('all') && { backgroundColor: C.ink, borderColor: C.ink }]}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="globe-outline" size={13} color={m.channels.includes('all') ? C.onInk : C.muted} />
                        <Text style={[s.chanT, m.channels.includes('all') && { color: C.onInk }]}>All channels</Text>
                      </TouchableOpacity>
                      {chanList.map((c) => {
                        const on = m.channels.includes(c.id);
                        return (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => toggleMemberChannel(m, c.id)}
                            style={[s.chan, on && { backgroundColor: C.ink, borderColor: C.ink }]}
                            activeOpacity={0.75}
                          >
                            <ChannelAvatar platform={c.provider} avatar={c.avatar} size={20} badge={false} />
                            <Text style={[s.chanT, on && { color: C.onInk }]}>{c.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()
            ) : null}

            {actor.role === 'owner' ? (
              <View style={s.plan}>
                <Text style={s.planT}>Invite teammate</Text>
                <Field label="Name">
                  <Txt value={mName} onChangeText={setMName} placeholder="e.g. Ain" />
                </Field>
                <Field label="Email">
                  <Txt value={mEmail} onChangeText={setMEmail} placeholder="teammate@studio.com" keyboardType="email-address" autoCapitalize="none" />
                </Field>
                <Field label="Channels they can post to">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => toggleMChannel('all')}
                      style={[s.chan, mChannels.includes('all') && { backgroundColor: C.ink, borderColor: C.ink }]}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="globe-outline" size={13} color={mChannels.includes('all') ? C.onInk : C.muted} />
                      <Text style={[s.chanT, mChannels.includes('all') && { color: C.onInk }]}>All channels</Text>
                    </TouchableOpacity>
                    {chanList.map((c) => {
                      const on = mChannels.includes(c.id);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => toggleMChannel(c.id)}
                          style={[s.chan, on && { backgroundColor: C.ink, borderColor: C.ink }]}
                          activeOpacity={0.75}
                        >
                          <ChannelAvatar platform={c.provider} avatar={c.avatar} size={20} badge={false} />
                          <Text style={[s.chanT, on && { color: C.onInk }]}>{c.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Field>
                <TouchableOpacity onPress={saveMember} style={[s.save, { marginTop: 12 }]} activeOpacity={0.85}>
                  <Text style={s.saveT}>Add teammate</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Compact pill action — one quiet row per member instead of stacked full-width buttons. */
function MiniBtn({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { C } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 7,
        backgroundColor: danger ? C.paleRed : C.surface,
        borderWidth: 1,
        borderColor: danger ? C.redText : C.lineSoft,
      }}
    >
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: danger ? C.redText : C.soft }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  kicker: { ...T.tag, color: C.accent, marginTop: 8 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  avatarT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: C.onInk },
  email: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, letterSpacing: -0.2, color: C.ink },
  team: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: 13 },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  miniAvatarT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: C.onInk },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 1 },
  rolePill: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  rolePillT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: C.accentInk, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chan: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft },
  chanT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  plan: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: 16, gap: 6 },
  planT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: C.ink },
  save: { backgroundColor: C.ink, borderRadius: R.md + 2, paddingVertical: 12, alignItems: 'center' },
  saveT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.onInk },
  note: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted, margin: 14 },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted },
  empty: { backgroundColor: C.card, borderRadius: R.lg, padding: 28, alignItems: 'center' },
  emptyT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.ink },
  emptyS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
