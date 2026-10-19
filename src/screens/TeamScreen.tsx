import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  supabase, getTeamAvatar, teamAvatarSignedUrl, avatarSignedUrl, setTeamAvatarFromUri, clearTeamAvatar,
} from '../utils/supabase';
import { useTheme, Palette, R, T } from '../theme';
import { Txt, Field, ChannelAvatar } from '../components/ui';
import TeamSwitcher from '../components/TeamSwitcher';
import {
  loadCloudTeam, createInvite, removeMember, setMemberGrants, cancelInvite,
  setMemberRole, leaveTeam,
  canRemoveMember, canAssignChannels, channelsSummary,
  type CloudTeam, type CloudMember, type CloudChannelOption, type TeamRole,
} from '../utils/teamCloud';

/**
 * Workspace roster, real cloud membership (same source as the web Team page).
 *
 * Two doors lead here: the Team button on top of Connect, and Account → Team.
 */
export default function TeamScreen({ plan, email, teamName, onBack, onSeePlans, onSwitched }: {
  plan: 'free' | 'pro' | 'team';
  email: string;
  teamName: string;
  onBack: () => void;
  onSeePlans: () => void;
  onSwitched: (ws: { id: string; name: string }) => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [team, setTeam] = useState<CloudTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [teamPicUri, setTeamPicUri] = useState<string | null>(null);
  const [teamPicBusy, setTeamPicBusy] = useState(false);
  const [teamPicFailed, setTeamPicFailed] = useState(false);
  const [memberPics, setMemberPics] = useState<Record<string, string>>({});
  const [failedPics, setFailedPics] = useState<Record<string, boolean>>({});

  const [mEmail, setMEmail] = useState('');
  const [mRole, setMRole] = useState<'member' | 'admin'>('member');
  const [mAll, setMAll] = useState(true);
  const [mProviders, setMProviders] = useState<string[]>([]);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [renamingTeam, setRenamingTeam] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [gAll, setGAll] = useState(true);
  const [gProviders, setGProviders] = useState<string[]>([]);

  const reload = async () => {
    const t = await loadCloudTeam().catch(() => null);
    setTeam(t);
    setLoading(false);
    if (t) {
      const path = await getTeamAvatar(t.workspaceId);
      setTeamPicUri(await teamAvatarSignedUrl(path));
      // Roster photos: teammates' prefixes are readable via the
      // avatars_teammate_read policy.
      try {
        const ids = t.members.map((m) => m.user_id).filter((id): id is string => !!id);
        if (ids.length > 0) {
          const { data } = await supabase().from('profiles').select('id, avatar_url').in('id', ids);
          const next: Record<string, string> = {};
          await Promise.all(
            ((data ?? []) as { id: string; avatar_url: string | null }[]).map(async (p) => {
              if (!p.avatar_url || !p.id) return;
              const u = await avatarSignedUrl(p.avatar_url);
              if (u) next[p.id] = u;
            }),
          );
          if (Object.keys(next).length > 0) setMemberPics(next);
        }
      } catch { /* initials fallback */ }
    } else {
      setTeamPicUri(null);
    }
    return t;
  };

  /** Pick a new team picture (managers only, enforced server-side too). */
  const changeTeamPic = async () => {
    if (!team || teamPicBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a team picture.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled || !r.assets[0]) return;
    setTeamPicBusy(true);
    try {
      await setTeamAvatarFromUri(team.workspaceId, r.assets[0].uri);
      setTeamPicUri(await teamAvatarSignedUrl(await getTeamAvatar(team.workspaceId)));
      Alert.alert('Updated', 'Team picture saved.');
    } catch (e: any) {
      Alert.alert('Couldn’t update', e?.message ?? 'Try again.');
    } finally {
      setTeamPicBusy(false);
    }
  };

  const removeTeamPic = async () => {
    if (!team || teamPicBusy) return;
    setTeamPicBusy(true);
    try {
      await clearTeamAvatar(team.workspaceId);
      setTeamPicUri(null);
    } catch (e: any) {
      Alert.alert('Couldn’t remove', e?.message ?? 'Try again.');
    } finally {
      setTeamPicBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  /* A signed URL is minted even when the stored file is gone, so a dead
   * picture fails at render time; fall back to the initial rather than blank. */
  useEffect(() => { setTeamPicFailed(false); }, [teamPicUri]);

  const actor = { userId: team?.myUserId ?? null, role: (team?.myRole ?? 'member') as TeamRole };
  const isManager = actor.role === 'owner' || actor.role === 'admin';
  /** Mirrors removal power: owners change anyone but owners, admins change members only. */
  const canChangeRole = (m: CloudMember): boolean => {
    if (!!m.user_id && m.user_id === team?.myUserId) return false;
    if (actor.role === 'owner') return m.role !== 'owner';
    if (actor.role === 'admin') return m.role === 'member';
    return false;
  };

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
      const res = await createInvite(team.workspaceId, mEmail, mRole, mAll, mProviders);
      setMEmail('');
      setMRole('member');
      setMAll(true);
      setMProviders([]);
      await reload();
      if (res.alreadyRegistered && res.inviteUrl) {
        // On Sosial already, no email can reach them, hand over the link.
        Alert.alert(
          "They're already on Sosial",
          `No email needed, send them this invite link:\n${res.inviteUrl}`,
          [
            { text: 'Done', style: 'cancel' },
            { text: 'Copy link', onPress: () => { void Clipboard.setStringAsync(res.inviteUrl!); } },
          ],
        );
      }
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

  const cancelPendingInvite = (inviteId: string, email: string) => {
    Alert.alert('Cancel invite', `Withdraw the invite to ${email}? They won't be able to join with it.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel invite',
        style: 'destructive',
        onPress: async () => {
          if (!team) return;
          setBusy(true);
          try {
            await cancelInvite(inviteId);
            await reload();
          } catch (e) {
            Alert.alert('Could not cancel', e instanceof Error ? e.message : 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const saveTeamName = async () => {
    if (!team) return;
    const name = teamNameDraft.trim() || 'My team';
    setBusy(true);
    try {
      const { error } = await supabase().from('workspaces').update({ name }).eq('id', team.workspaceId);
      if (error) throw new Error(error.message);
      setRenamingTeam(false);
      await reload();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async (m: CloudMember, role: 'member' | 'admin') => {
    if (role === m.role) return;
    setBusy(true);
    try {
      await setMemberRole(m.id, role);
      await reload();
    } catch (e) {
      Alert.alert('Could not change role', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    Alert.alert('Leave team', 'Walk away from this workspace? You lose its channels, posts and team.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          if (!team) return;
          setBusy(true);
          try {
            await leaveTeam(team.workspaceId);
            onBack();
          } catch (e) {
            Alert.alert('Could not leave', e instanceof Error ? e.message : 'Try again.');
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
  // The header above already shows the current user, the roster lists teammates only.
  const others = (team?.members ?? []).filter((m) => !(m.user_id && team?.myUserId && m.user_id === team.myUserId));

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.kicker}>Workspace</Text>
        <Text style={[T.h1, { color: C.ink, marginTop: 8, fontSize: 30, lineHeight: 36 }]}>Team</Text>
        {team ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <TouchableOpacity
              onPress={() => {
                if (!isManager) return;
                Alert.alert('Team picture', teamPicUri ? 'Change or remove the team picture.' : 'Add a picture for this team.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: teamPicUri ? 'Change photo' : 'Add photo', onPress: () => void changeTeamPic() },
                  ...(teamPicUri ? [{ text: 'Remove', style: 'destructive' as const, onPress: () => void removeTeamPic() }] : []),
                ]);
              }}
              disabled={!isManager}
              accessibilityLabel={isManager ? 'Change team picture' : 'Team picture'}
              activeOpacity={isManager ? 0.75 : 1}
            >
              {teamPicUri && !teamPicFailed ? (
                <Image source={{ uri: teamPicUri }} onError={() => setTeamPicFailed(true)} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <View style={[s.avatar, { width: 44, height: 44, borderRadius: 22 }]}>
                  <Text style={s.avatarT}>{(team.workspaceName || 'T')[0].toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={s.sub} numberOfLines={1}>
                {team.workspaceName} · {team.members.length} member{team.members.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        ) : null}
        {team && isManager ? (
          renamingTeam ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt value={teamNameDraft} onChangeText={setTeamNameDraft} placeholder="Team name" />
              </View>
              <TouchableOpacity onPress={() => void saveTeamName()} style={[s.miniBtn, { backgroundColor: C.ink }]} activeOpacity={0.7}>
                <Text style={[s.miniBtnT, { color: C.onInk }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRenamingTeam(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={C.redText} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setTeamNameDraft(team.workspaceName); setRenamingTeam(true); }} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.accentInk }}>Rename team</Text>
            </TouchableOpacity>
          )
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Text style={s.sectionLabel}>SWITCH TEAM</Text>
          <View style={{ marginTop: 8 }}>
            <TeamSwitcher team={team?.workspaceName ?? teamName} onSwitched={onSwitched} full />
          </View>
        </View>

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
                  {m.user_id && memberPics[m.user_id] && !failedPics[m.user_id] ? (
                    <Image source={{ uri: memberPics[m.user_id] }} onError={() => setFailedPics((p) => ({ ...p, [m.user_id as string]: true }))} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  ) : (
                    <View style={s.miniAvatar}><Text style={s.miniAvatarT}>{(m.email || '?')[0].toUpperCase()}</Text></View>
                  )}
                  <View style={{ flex: 1, gap: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Text style={s.rowT} numberOfLines={1}>{m.email}</Text>
                      {isSelf ? <Text style={s.youTag}>(you)</Text> : null}
                      <View style={s.rolePill}><Text style={s.rolePillT}>{m.role}</Text></View>
                    </View>
                    <Text style={s.rowS} numberOfLines={1}>{channelsSummary(m, team.channels)}</Text>
                    {showChannels || showTrash || canChangeRole(m) ? (
                      <View style={s.actions}>
                        {canChangeRole(m) ? (
                          <MiniBtn
                            label={m.role === 'admin' ? 'Make member' : 'Make admin'}
                            disabled={busy}
                            onPress={() => void saveRole(m, m.role === 'admin' ? 'member' : 'admin')}
                          />
                        ) : null}                        {showChannels ? (
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
                        <View style={{ marginTop: 8 }}>
                          <ScopePills
                            C={C}
                            s={s}
                            channels={team.channels}
                            all={gAll}
                            selected={gProviders}
                            onAll={() => { setGAll(true); setGProviders([]); }}
                            onToggle={toggleGProvider}
                          />
                        </View>
                        {team.channels.length === 0 ? (
                          <Text style={s.hint}>Connect an account first, there are no channels to appoint yet.</Text>
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
                  <TouchableOpacity
                    key={inv.id}
                    onPress={() => {
                      if (inv.emailed_at) return;
                      const url = `https://sosial.app/invite/${inv.token}`;
                      Alert.alert(
                        'Email never sent',
                        `Share this invite link directly:\n${url}`,
                        [
                          { text: 'Close', style: 'cancel' },
                          { text: 'Copy link', onPress: () => { void Clipboard.setStringAsync(url); } },
                        ],
                      );
                    }}
                    disabled={!!inv.emailed_at}
                    activeOpacity={inv.emailed_at ? 1 : 0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={s.rowS} numberOfLines={1}>{inv.email}</Text>
                          <View style={s.rolePill}><Text style={s.rolePillT}>{inv.role}</Text></View>
                          {isManager ? (
                            <TouchableOpacity onPress={() => cancelPendingInvite(inv.id, inv.email)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <Ionicons name="close-circle" size={17} color={C.redText} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <Text style={[s.rowS, { color: inv.emailed_at ? C.faint : C.accentInk }]}>
                          {inv.emailed_at ? 'Invite sent' : 'Email pending, tap for the link'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
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
                  <ScopePills
                    C={C}
                    s={s}
                    channels={team.channels}
                    all={mAll}
                    selected={mProviders}
                    onAll={() => { setMAll(true); setMProviders([]); }}
                    onToggle={toggleMProvider}
                  />
                </Field>
                <TouchableOpacity onPress={invite} disabled={busy} style={[s.save, { marginTop: 12 }]} activeOpacity={0.85}>
                  <Text style={s.saveT}>{busy ? 'Sending…' : 'Send invite'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={s.hint}>Only the owner and admins can invite or appoint accounts. Ask one to add your teammates.</Text>
            )}

            {actor.role !== 'owner' ? (
              <TouchableOpacity onPress={leave} activeOpacity={0.7} style={{ marginTop: 4, alignSelf: 'center' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.redText }}>Leave team</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Shared channel-scope picker: the composer's channel chips (avatar, provider
 *  name, handle) reused for invites and per-member appointments. */
function ScopePills({ C, s, channels, all, selected, onAll, onToggle }: {
  C: Palette;
  s: ReturnType<typeof makeS>;
  channels: CloudChannelOption[];
  all: boolean;
  selected: string[];
  onAll: () => void;
  onToggle: (provider: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <TouchableOpacity
        onPress={onAll}
        style={[s.chan, all && { backgroundColor: C.ink, borderColor: C.ink }]}
        activeOpacity={0.75}
      >
        <Ionicons name="globe-outline" size={14} color={all ? C.onInk : C.muted} />
        <Text style={[s.chanT, all && { color: C.onInk }]}>All channels</Text>
      </TouchableOpacity>
      {channels.map((c) => {
        const on = !all && selected.includes(c.provider);
        return (
          <TouchableOpacity
            key={c.provider + c.external_id}
            onPress={() => onToggle(c.provider)}
            style={[s.chan, on && { backgroundColor: C.ink, borderColor: C.ink }]}
            activeOpacity={0.75}
          >
            <ChannelAvatar platform={c.provider} avatar={c.avatar} size={22} />
            <View style={{ gap: 0 }}>
              <Text style={[s.chanT, on && { color: C.onInk }]}>{c.label}</Text>
              {c.handle ? (
                <Text
                  style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: on ? C.onInk : C.muted }}
                  numberOfLines={1}
                >
                  {c.handle}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Compact pill action, one quiet row per member instead of stacked full-width buttons. */
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
  sectionLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1, color: C.faint },
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
  del: { fontSize: 14, color: C.faint },
  miniBtn: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: R.md, backgroundColor: C.card },
  miniBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.ink },
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
