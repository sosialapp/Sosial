import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  supabase, getTeamAvatar, teamAvatarSignedUrl, avatarSignedUrl, setTeamAvatarFromUri, clearTeamAvatar,
} from '../utils/supabase';
import { useTheme, Palette, T } from '../theme';
import { Txt, ChannelAvatar, Seg } from '../components/ui';
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

  const members = team?.members ?? [];
  const leads = members.filter((m) => m.role === 'owner' || m.role === 'admin').length;
  const roleIcon = (r: string): keyof typeof Ionicons.glyphMap =>
    r === 'owner' ? 'ribbon' : r === 'admin' ? 'shield-checkmark' : 'person';
  const roleName = (r: string) => (r === 'owner' ? 'Owner' : r === 'admin' ? 'Admin' : 'Member');

  const teamPicMenu = () => {
    if (!isManager) return;
    Alert.alert('Team picture', teamPicUri ? 'Change or remove the team picture.' : 'Add a picture for this team.', [
      { text: 'Cancel', style: 'cancel' },
      { text: teamPicUri ? 'Change photo' : 'Add photo', onPress: () => void changeTeamPic() },
      ...(teamPicUri ? [{ text: 'Remove', style: 'destructive' as const, onPress: () => void removeTeamPic() }] : []),
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.topRow}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[T.h1, { color: C.ink, fontSize: 28, lineHeight: 34 }]}>Team</Text>
            <Text style={s.sub}>Who can post where, and who can invite.</Text>
          </View>
        </View>

        {/* Team card: picture, name, headcount at a glance. */}
        {team ? (
          <View style={[s.card, { marginTop: 18, overflow: 'hidden', padding: 0 }]}>
            <View style={s.banner} />
            <View style={{ paddingHorizontal: 18, paddingBottom: 18, marginTop: -36 }}>
              <TouchableOpacity
                onPress={teamPicMenu}
                disabled={!isManager}
                accessibilityLabel={isManager ? 'Change team picture' : 'Team picture'}
                activeOpacity={isManager ? 0.8 : 1}
                style={{ alignSelf: 'flex-start' }}
              >
                {teamPicUri && !teamPicFailed ? (
                  <Image source={{ uri: teamPicUri }} onError={() => setTeamPicFailed(true)} style={s.teamPic} />
                ) : (
                  <View style={[s.teamPic, { backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={s.teamPicT}>{(team.workspaceName || 'T')[0].toUpperCase()}</Text>
                  </View>
                )}
                {teamPicBusy ? (
                  <View style={[s.teamPic, s.teamPicBusy]}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
                {isManager ? (
                  <View style={s.camBadge}>
                    <Ionicons name="camera" size={13} color={C.onInk} />
                  </View>
                ) : null}
              </TouchableOpacity>

              {isManager && renamingTeam ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Txt value={teamNameDraft} onChangeText={setTeamNameDraft} placeholder="Team name" />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => void saveTeamName()} disabled={busy} style={[s.save, { flex: 1 }]} activeOpacity={0.85}>
                      <Text style={s.saveT}>{busy ? 'Saving…' : 'Save'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setRenamingTeam(false)} style={[s.ghost, { flex: 1 }]} activeOpacity={0.85}>
                      <Text style={s.ghostT}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (!isManager) return;
                    setTeamNameDraft(team.workspaceName);
                    setRenamingTeam(true);
                  }}
                  disabled={!isManager}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}
                  accessibilityLabel={isManager ? 'Rename team' : undefined}
                >
                  <Text style={s.teamName} numberOfLines={1}>{team.workspaceName}</Text>
                  {isManager ? <Ionicons name="pencil" size={15} color={C.faint} /> : null}
                </TouchableOpacity>
              )}

              <View style={s.stats}>
                {([
                  [members.length, 'Members'],
                  [leads, 'Leads'],
                  [team.invites.length, 'Pending'],
                ] as const).map(([n, label]) => (
                  <View key={label} style={s.stat}>
                    <Text style={s.statN}>{n}</Text>
                    <Text style={s.statL}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <Text style={[s.sectionLabel, { marginTop: 22 }]}>SWITCH TEAM</Text>
        <View style={{ marginTop: 8 }}>
          <TeamSwitcher team={team?.workspaceName ?? teamName} onSwitched={onSwitched} full />
        </View>

        {plan !== 'team' ? (
          <View style={[s.empty, { marginTop: 16 }]}>
            <View style={s.emptyIcon}><Ionicons name="people" size={22} color={C.ink} /></View>
            <Text style={s.emptyT}>Team tools need Sosial Team</Text>
            <Text style={s.emptyS}>The roster, roles and per-channel assignment unlock on the Team plan.</Text>
            <TouchableOpacity onPress={onSeePlans} style={[s.save, { marginTop: 14, alignSelf: 'stretch' }]} activeOpacity={0.85}>
              <Text style={s.saveT}>See plans</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={C.muted} />
        ) : !team ? (
          <View style={[s.empty, { marginTop: 16 }]}>
            <Text style={s.emptyT}>Not signed in</Text>
            <Text style={s.emptyS}>Sign in to Sosial Cloud (Account tab) to manage your team across devices.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 16, gap: 14 }}>
            {/* Roster: everyone, you first. */}
            <View style={[s.card, { padding: 0 }]}>
              <Text style={[s.cardT, { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }]}>
                Members <Text style={{ color: C.faint }}>· {members.length}</Text>
              </Text>
              {[...members]
                .sort((a, b) => Number(b.user_id === team.myUserId) - Number(a.user_id === team.myUserId))
                .map((m, i) => {
                  const isSelf = !!m.user_id && m.user_id === team.myUserId;
                  const showChannels = !isSelf && canAssignChannels(actor, m);
                  const showTrash = !isSelf && canRemoveMember(actor, m);
                  const open = assigningId === m.id;
                  return (
                    <View key={m.id} style={[s.memberRow, i > 0 && s.memberDivider, open && { backgroundColor: C.surface }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {m.user_id && memberPics[m.user_id] && !failedPics[m.user_id] ? (
                          <Image
                            source={{ uri: memberPics[m.user_id] }}
                            onError={() => setFailedPics((p) => ({ ...p, [m.user_id as string]: true }))}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                          />
                        ) : (
                          <View style={s.miniAvatar}><Text style={s.miniAvatarT}>{(m.email || '?')[0].toUpperCase()}</Text></View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.rowT} numberOfLines={1}>{m.email}</Text>
                            {isSelf ? <View style={s.youTag}><Text style={s.youTagT}>you</Text></View> : null}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <View style={[s.rolePill, m.role === 'owner' && { backgroundColor: C.ink }, m.role === 'member' && { backgroundColor: C.surface }]}>
                              <Ionicons name={roleIcon(m.role)} size={11} color={m.role === 'owner' ? C.onInk : C.ink} />
                              <Text style={[s.rolePillT, m.role === 'owner' && { color: C.onInk }]}>{roleName(m.role)}</Text>
                            </View>
                            <Text style={s.rowS} numberOfLines={1}>{channelsSummary(m, team.channels)}</Text>
                          </View>
                        </View>
                      </View>

                      {showChannels || showTrash || canChangeRole(m) ? (
                        <View style={s.actions}>
                          {canChangeRole(m) ? (
                            <Seg
                              accessibilityLabel={`Role for ${m.email}`}
                              grow={false}
                              value={m.role as 'member' | 'admin'}
                              onChange={(r) => { if (!busy) void saveRole(m, r); }}
                              options={[
                                { value: 'member', label: 'Member' },
                                { value: 'admin', label: 'Admin' },
                              ]}
                            />
                          ) : null}
                          {showChannels ? (
                            <TouchableOpacity
                              onPress={() => openAssign(m)}
                              disabled={busy}
                              activeOpacity={0.75}
                              style={[s.pillBtn, open && { backgroundColor: C.ink, borderColor: C.ink }]}
                            >
                              <Ionicons name="at" size={13} color={open ? C.onInk : C.soft} />
                              <Text style={[s.pillBtnT, open && { color: C.onInk }]}>{open ? 'Done' : 'Channels'}</Text>
                            </TouchableOpacity>
                          ) : null}
                          {showTrash ? (
                            <TouchableOpacity
                              onPress={() => dropMember(m)}
                              disabled={busy}
                              activeOpacity={0.75}
                              style={s.trashBtn}
                              accessibilityLabel={`Remove ${m.email}`}
                            >
                              <Ionicons name="trash-outline" size={16} color={C.redText} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : null}

                      {open ? (
                        <View style={[s.card, { marginTop: 12, gap: 10 }]}>
                          <Text style={s.fieldL}>Accounts {m.email} can post to</Text>
                          <ScopePills
                            C={C}
                            s={s}
                            channels={team.channels}
                            all={gAll}
                            selected={gProviders}
                            onAll={() => { setGAll(true); setGProviders([]); }}
                            onToggle={toggleGProvider}
                          />
                          {team.channels.length === 0 ? (
                            <Text style={s.hint}>Connect an account first, there are no channels to appoint yet.</Text>
                          ) : null}
                          <TouchableOpacity onPress={() => saveGrants(m)} disabled={busy} style={s.save} activeOpacity={0.85}>
                            <Text style={s.saveT}>{busy ? 'Saving…' : 'Save channels'}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
            </View>

            {isManager ? (
              <View style={[s.card, { gap: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={s.inviteIcon}><Ionicons name="person-add" size={16} color="#0b1220" /></View>
                  <Text style={s.cardT}>Invite teammate</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.fieldL}>Email</Text>
                  <Txt value={mEmail} onChangeText={setMEmail} placeholder="teammate@studio.com" keyboardType="email-address" autoCapitalize="none" />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.fieldL}>Role</Text>
                  <Seg
                    accessibilityLabel="Role"
                    value={mRole}
                    onChange={setMRole}
                    options={[
                      { value: 'member', label: 'Member' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                  />
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={s.fieldL}>Accounts they can post to</Text>
                  <ScopePills
                    C={C}
                    s={s}
                    channels={team.channels}
                    all={mAll}
                    selected={mProviders}
                    onAll={() => { setMAll(true); setMProviders([]); }}
                    onToggle={toggleMProvider}
                  />
                </View>
                <TouchableOpacity onPress={invite} disabled={busy} style={s.save} activeOpacity={0.85}>
                  <Text style={s.saveT}>{busy ? 'Sending…' : 'Send invite'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.card}>
                <Text style={s.hint}>Only the owner and admins can invite or appoint accounts. Ask one to add your teammates.</Text>
              </View>
            )}

            {team.invites.length > 0 ? (
              <View style={[s.card, { gap: 10 }]}>
                <Text style={s.cardT}>
                  Pending invites <Text style={{ color: C.faint }}>· {team.invites.length}</Text>
                </Text>
                {team.invites.map((inv) => (
                  <TouchableOpacity
                    key={inv.id}
                    onPress={() => {
                      if (inv.emailed_at) return;
                      const url = `https://sosial.app/invite/${inv.token}`;
                      Alert.alert('Email never sent', `Share this invite link directly:\n${url}`, [
                        { text: 'Close', style: 'cancel' },
                        { text: 'Copy link', onPress: () => { void Clipboard.setStringAsync(url); } },
                      ]);
                    }}
                    disabled={!!inv.emailed_at}
                    activeOpacity={inv.emailed_at ? 1 : 0.7}
                    style={s.inviteRow}
                  >
                    <View style={s.mailDot}><Ionicons name="mail-outline" size={16} color={C.faint} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowT} numberOfLines={1}>{inv.email}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Ionicons name={roleIcon(inv.role)} size={11} color={C.muted} />
                        <Text style={s.rowS}>{roleName(inv.role)}</Text>
                        <Text style={[s.rowS, { color: inv.emailed_at ? C.faint : C.accentInk }]} numberOfLines={1}>
                          · {inv.emailed_at ? 'Invite sent' : 'Email pending, tap for the link'}
                        </Text>
                      </View>
                    </View>
                    {isManager ? (
                      <TouchableOpacity
                        onPress={() => cancelPendingInvite(inv.id, inv.email)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={s.trashBtn}
                        accessibilityLabel={`Cancel invite to ${inv.email}`}
                      >
                        <Ionicons name="close" size={16} color={C.redText} />
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {actor.role !== 'owner' ? (
              <TouchableOpacity onPress={leave} activeOpacity={0.7} style={s.leaveBtn}>
                <Ionicons name="log-out-outline" size={16} color={C.redText} />
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.redText }}>Leave team</Text>
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

const makeS = (C: Palette) => StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  sectionLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1, color: C.faint },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.lineSoft, padding: 16 },
  cardT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: C.ink },
  banner: { height: 64, backgroundColor: C.accentSoft },
  teamPic: { width: 72, height: 72, borderRadius: 22, borderWidth: 4, borderColor: C.card },
  teamPicT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: C.onInk },
  teamPicBusy: { position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  camBadge: { position: 'absolute', right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, borderWidth: 2, borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, letterSpacing: -0.3, color: C.ink, flexShrink: 1 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: C.surface, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  statN: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: C.ink },
  statL: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.muted, marginTop: 2 },
  memberRow: { paddingHorizontal: 16, paddingVertical: 14 },
  memberDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  miniAvatarT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: C.onInk },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink, flexShrink: 1 },
  youTag: { backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  youTagT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: '#0b1220' },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, flexShrink: 1 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  rolePillT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12, marginLeft: 52 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 8 },
  pillBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.soft },
  trashBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.paleRed, alignItems: 'center', justifyContent: 'center' },
  fieldL: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.muted },
  inviteIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, padding: 10 },
  mailDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  chan: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineSoft },
  chanT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  save: { backgroundColor: C.ink, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  saveT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.onInk },
  ghost: { backgroundColor: C.surface, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  ghostT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: C.paleRed },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted },
  empty: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.lineSoft, padding: 24, alignItems: 'center' },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.ink },
  emptyS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
