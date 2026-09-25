import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { Txt, Field, ChannelAvatar } from '../components/ui';
import {
  loadCloudTeam, createInvite, removeMember, setMemberGrants,
  canRemoveMember, canAssignChannels, channelsSummary,
  type CloudTeam, type CloudMember, type TeamRole,
} from '../utils/teamCloud';

/**
 * Workspace roster — real cloud membership (same source as the web Team page).
 * Owners appoint which connected accounts each teammate may post to; only the
 * owner can disconnect a connected account (that lives on the Channels screen).
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
  const [team, setTeam] = useState<CloudTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [mEmail, setMEmail] = useState('');
  const [mRole, setMRole] = useState<'member' | 'admin'>('member');
  const [mAll, setMAll] = useState(true);
  const [mProviders, setMProviders] = useState<string[]>([]);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [gAll, setGAll] = useState(true);
  const [gProviders, setGProviders] = useState<string[]>([]);

  const reload = async () => {
    const t = await loadCloudTeam().catch(() => null);
    setTeam(t);
    setLoading(false);
    return t;
  };

  useEffect(() => { void reload(); }, []);

  const actor = { userId: team?.myUserId ?? null, role: (team?.myRole ?? 'member') as TeamRole };
  const isManager = actor.role === 'owner' || actor.role === 'admin';

  const openAssign = (m: CloudMember) => {
    if (assigningId === m.id) { setAssigningId(null); return; }
    setGAll(m.all_channels || m.providers.length === 0);
    setGProviders(m.providers);
    setAssigningId(m.id);
  };

  const toggleGProvider = (p: string) => {
    setGAll(false);
    setGProviders((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const saveGrants = async (m: CloudMember) => {
    setBusy(true);
    try {
      await setMemberGrants(m.id, gAll ? [] : gProviders, gAll);
      setAssigningId(null);
      await reload();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!team) return;
    if (!mEmail.trim()) {
      Alert.alert('Email needed', 'Add the teammate’s email so the invite reaches them.');
      return;
    }
    setBusy(true);
    try {
      await createInvite(team.workspaceId, mEmail, mRole, mAll);
      setMEmail('');
      setMRole('member');
      setMAll(true);
      setMProviders([]);
      await reload();
    } catch (e) {
      Alert.alert('Could not send invite', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const dropMember = (m: CloudMember) => {
    Alert.alert('Remove teammate', `Remove ${m.email} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          if (!team) return;
          setBusy(true);
          try {
            await removeMember(team.workspaceId, m.user_id);
            await reload();
          } catch (e) {
            Alert.alert('Could not remove', e instanceof Error ? e.message : 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const toggleMProvider = (p: string) => {
    setMAll(false);
    setMProviders((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const initial = (email || teamName || 'Z')[0].toUpperCase();
  const others = (team?.members ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.kicker}>Workspace</Text>
        <Text style={[T.h1, { color: C.ink, marginTop: 8, fontSize: 30, lineHeight: 36 }]}>Team</Text>
        {team ? (
          <Text style={s.sub}>
            {team.workspaceName} · {team.members.length} member{team.members.length === 1 ? '' : 's'}
          </Text>
        ) : null}

        {plan !== 'team' ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={s.empty}>
              <Text style={s.emptyT}>Team tools need Sosial Team</Text>
              <Text style={s.emptyS}>The roster, roles and per-channel assignment unlock on the Team plan.</Text>
              <TouchableOpacity onPress={onSeePlans} style={[s.save, { marginTop: 12 }]} activeOpacity={0.85}>
                <Text style={s.saveT}>See plans</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={C.muted} />
        ) : !team ? (
          <View style={{ marginTop: 16 }}>
            <View style={s.empty}>
              <Text style={s.emptyT}>Not signed in</Text>
              <Text style={s.emptyS}>Sign in to Sosial Cloud (Account tab) to manage your team across devices.</Text>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 16, gap: 12 }}>
            <Text style={s.note}>
              Owners appoint which accounts each teammate can post to. Only the owner can disconnect a connected
              account — do that on the Channels screen.
            </Text>

            <View style={s.head}>
              <View style={s.avatar}><Text style={s.avatarT}>{initial}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.email} numberOfLines={1}>{email || 'No email set'}</Text>
                <Text style={s.team} numberOfLines={1}>{team.workspaceName} · {team.myRole}</Text>
              </View>
            </View>

            {others.map((m) => {
              const isSelf = !!m.user_id && m.user_id === team.myUserId;
              const showChannels = !isSelf && canAssignChannels(actor, m);
              const showTrash = !isSelf && canRemoveMember(actor, m);
              return (
                <View key={m.id} style={s.member}>
                  <View style={s.miniAvatar}><Text style={s.miniAvatarT}>{(m.email || '?')[0].toUpperCase()}</Text></View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Text style={s.rowT} numberOfLines={1}>{m.email}</Text>
                      {isSelf ? <Text style={s.youTag}>(you)</Text> : null}
                      <View style={s.rolePill}><Text style={s.rolePillT}>{m.role}</Text></View>
                    </View>
                    <Text style={s.rowS} numberOfLines={1}>{channelsSummary(m, team.channels)}</Text>
                    {showChannels || showTrash ? (
                      <View style={s.actions}>
                        {showChannels ? (
                          <MiniBtn label={assigningId === m.id ? 'Done' : 'Assign channels'} disabled={busy} onPress={() => openAssign(m)} />
                        ) : null}
                        {showTrash ? (
                          <MiniBtn label="Remove" danger disabled={busy} onPress={() => dropMember(m)} />
                        ) : null}
                      </View>
                    ) : null}

                    {assigningId === m.id ? (
                      <View style={s.plan}>
                        <Text style={s.planT}>Accounts for {m.email}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            onPress={() => setGAll(true)}
                            style={[s.chan, gAll && { backgroundColor: C.ink, borderColor: C.ink }]}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="globe-outline" size={13} color={gAll ? C.onInk : C.muted} />
                            <Text style={[s.chanT, gAll && { color: C.onInk }]}>All channels</Text>
                          </TouchableOpacity>
                          {team.channels.map((c) => {
                            const on = !gAll && gProviders.includes(c.provider);
                            return (
                              <TouchableOpacity
                                key={c.provider + c.external_id}
                                onPress={() => toggleGProvider(c.provider)}
                                style={[s.chan, on && { backgroundColor: C.ink, borderColor: C.ink }]}
                                activeOpacity={0.75}
                              >
                                <ChannelAvatar platform={c.provider} avatar={c.avatar} size={20} badge={false} />
                                <Text style={[s.chanT, on && { color: C.onInk }]}>{c.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {team.channels.length === 0 ? (
                          <Text style={s.hint}>Connect an account first — there are no channels to appoint yet.</Text>
                        ) : null}
                        <TouchableOpacity onPress={() => saveGrants(m)} disabled={busy} style={[s.save, { marginTop: 12 }]} activeOpacity={0.85}>
                          <Text style={s.saveT}>{busy ? 'Saving…' : 'Save channels'}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {team.invites.length > 0 ? (
              <View style={s.plan}>
                <Text style={s.planT}>Pending invites</Text>
                {team.invites.map((inv) => (
                  <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Text style={s.rowS} numberOfLines={1}>{inv.email}</Text>
                    <View style={s.rolePill}><Text style={s.rolePillT}>{inv.role}</Text></View>
                  </View>
                ))}
              </View>
            ) : null}

            {isManager ? (
              <View style={s.plan}>
                <Text style={s.planT}>Invite teammate</Text>
                <Field label="Email">
                  <Txt value={mEmail} onChangeText={setMEmail} placeholder="teammate@studio.com" keyboardType="email-address" autoCapitalize="none" />
                </Field>
                <Field label="Role">
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['member', 'admin'] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setMRole(r)}
                        style={[s.chan, mRole === r && { backgroundColor: C.ink, borderColor: C.ink }]}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.chanT, mRole === r && { color: C.onInk }]}>{r === 'admin' ? 'Admin' : 'Member'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>
                <Field label="Accounts they can post to">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => { setMAll(true); setMProviders([]); }}
                      style={[s.chan, mAll && { backgroundColor: C.ink, borderColor: C.ink }]}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="globe-outline" size={13} color={mAll ? C.onInk : C.muted} />
                      <Text style={[s.chanT, mAll && { color: C.onInk }]}>All channels</Text>
                    </TouchableOpacity>
                    {team.channels.map((c) => {
                      const on = !mAll && mProviders.includes(c.provider);
                      return (
                        <TouchableOpacity
                          key={c.provider + c.external_id}
                          onPress={() => toggleMProvider(c.provider)}
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
                <TouchableOpacity onPress={invite} disabled={busy} style={[s.save, { marginTop: 12 }]} activeOpacity={0.85}>
                  <Text style={s.saveT}>{busy ? 'Sending…' : 'Send invite'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={s.hint}>Only the owner and admins can invite or appoint accounts. Ask one to add your teammates.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Compact pill action — one quiet row per member instead of stacked full-width buttons. */
function MiniBtn({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const { C } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={{
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 7,
        opacity: disabled ? 0.5 : 1,
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
  youTag: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted },
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
