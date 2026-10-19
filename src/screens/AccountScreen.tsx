import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, Switch, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { Txt, Field, Seg, GhostBtn } from '../components/ui';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { wipeAllData } from '../utils/account';
import { TERMS_TEXT } from '../utils/legal';
import { supabase, currentSession, signUpEmail, signInEmail, signInWithGoogle, signOutCloud, onCloudAuthChange, isSupabaseConfigured, pullProfileFromCloud, callEdgeFunction, WorkspaceInfo, getMyAvatar, avatarSignedUrl, setAvatarFromUri, clearMyAvatar } from '../utils/supabase';
import { loadMetaState, connectedChannelIds } from '../utils/metaStore';
import { loadCloudChannels, syncCloudChannels } from '../utils/cloudChannels';
import { registerPushToken, registerPushTokenFull, pushDiagnostics, type PushDiag } from '../utils/pushTokens';

WebBrowser.maybeCompleteAuthSession();

type AcctView = 'main' | 'notif' | 'email' | 'password' | 'plan' | 'changelog' | 'terms' | 'legal' | 'report' | 'delete';

type ReportKind = 'bug' | 'idea' | 'billing' | 'other';

const CHANGELOG = [
  { v: '1.0.0', notes: ['Buffer-style app: Create, Post and Analytics tabs', 'Ideas feed with design-studio link', 'Queue / drafts / approvals / sent pipeline', 'Per-channel insights, top posts and comments', 'Meta login via secure bridge page'] },
];

/** Account settings: notifications, email, password, plan, legal… (all on-device, no backend). */
export default function AccountScreen({ email, team, plan, notifPosts, notifComments, notifWeekly, onUpdate, onBack, onConnect, onPrivacy, onLoggedOut, onTeam }: {
  email: string;
  team: string;
  plan: 'free' | 'pro' | 'team';
  notifPosts: boolean;
  notifComments: boolean;
  notifWeekly: boolean;
  onUpdate: (patch: { email?: string; team?: string; plan?: 'free' | 'pro' | 'team'; notifPosts?: boolean; notifComments?: boolean; notifWeekly?: boolean }) => void;
  onBack: () => void;
  onConnect: () => void;
  onPrivacy: () => void;
  onLoggedOut: () => void;
  onTeam: () => void;
}) {
  const { C, mode, toggle } = useTheme();
  const s = makeS(C);
  const [view, setView] = useState<AcctView>('main');
  const [yearly, setYearly] = useState(true);
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftTeam, setDraftTeam] = useState(team);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [repKind, setRepKind] = useState<ReportKind>('bug');
  const [repSubject, setRepSubject] = useState('');
  const [repBody, setRepBody] = useState('');
  const [repBusy, setRepBusy] = useState(false);
  const [repShots, setRepShots] = useState<{ uri: string; name: string; mime: string }[]>([]);
  const [myTicket, setMyTicket] = useState<UserTicket | null | undefined>(undefined);
  const [pfpUri, setPfpUri] = useState<string | null>(null);
  const [pfpFailed, setPfpFailed] = useState(false);
  const [pfpBusy, setPfpBusy] = useState(false);

  type UserTicket = {
    id: string;
    kind: string;
    subject: string;
    body: string;
    status: string;
    admin_note: string;
    attachments: string[];
    created_at: string;
  };

  /** Pick a new profile picture from the library. */
  const changePfp = async () => {
    if (pfpBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled || !r.assets[0]) return;
    setPfpBusy(true);
    try {
      await setAvatarFromUri(r.assets[0].uri);
      const path = await getMyAvatar();
      const uri = await avatarSignedUrl(path);
      setPfpUri(uri);
      Alert.alert('Updated', 'Profile picture saved.');
    } catch (e: any) {
      Alert.alert('Couldn’t update', e?.message ?? 'Try again.');
    } finally {
      setPfpBusy(false);
    }
  };

  /** Adopt the Google account picture. */
  const useGooglePfp = async () => {
    if (pfpBusy) return;
    setPfpBusy(true);
    try {
      await callEdgeFunction('profile-avatar', { source: 'google' });
      const path = await getMyAvatar();
      const uri = await avatarSignedUrl(path);
      setPfpUri(uri);
      Alert.alert('Updated', 'Using your Google profile picture.');
    } catch (e: any) {
      Alert.alert('Not available', e?.message ?? 'No Google picture on this account.');
    } finally {
      setPfpBusy(false);
    }
  };

  const removePfp = async () => {
    if (pfpBusy) return;
    setPfpBusy(true);
    try {
      await clearMyAvatar();
      setPfpUri(null);
    } finally {
      setPfpBusy(false);
    }
  };

  /* Self-serve erasure: server wipe (delete-account fn) + local wipe. */
  const [delArmed, setDelArmed] = useState(false);
  const [delWord, setDelWord] = useState('');
  const [delBusy, setDelBusy] = useState(false);

  /* Sosial Cloud (Supabase staging), real accounts live alongside the legacy
   * on-device profile until the profile/team migration lands. */
  const [sbState, setSbState] = useState<'checking' | 'off' | 'in' | 'unconfigured'>('checking');
  const [sbEmail, setSbEmail] = useState('');
  const [sbPw, setSbPw] = useState('');
  const [sbBusy, setSbBusy] = useState(false);
  const [sbErr, setSbErr] = useState<string | null>(null);
  const [sbNotice, setSbNotice] = useState<string | null>(null);
  const [sbAccount, setSbAccount] = useState<{ email: string; workspace: WorkspaceInfo } | null>(null);
  const [cloudImp, setCloudImp] = useState(0);
  const [cloudConn, setCloudConn] = useState(0);

  /* Load the profile picture whenever the cloud account changes. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const path = await getMyAvatar();
      const uri = await avatarSignedUrl(path);
      if (alive) setPfpUri(uri);
    })();
    return () => { alive = false; };
  }, [sbState, sbAccount?.email]);

  /* A signed URL is minted even when the stored file is gone, so a dead
   * picture fails at render time; fall back to the initial rather than blank. */
  useEffect(() => { setPfpFailed(false); }, [pfpUri]);

  /* Owner-push self-check: surfaces registration state instead of failing
   * silently, so a missing device is diagnosable on-device. */
  const [pushDiag, setPushDiag] = useState<PushDiag | null>(null);
  const [pushDiagBusy, setPushDiagBusy] = useState(false);

  const retryPush = async () => {
    setPushDiagBusy(true);
    try {
      const r = await registerPushTokenFull();
      setPushDiag(await pushDiagnostics());
      const s = await currentSession().catch(() => null);
      let saved = false;
      if (s) {
        const { data } = await supabase()
          .from('push_tokens')
          .select('id')
          .eq('user_id', s.user.id)
          .limit(1);
        saved = (data?.length ?? 0) > 0;
      }
      if (saved) {
        Alert.alert(
          'Device registration',
          'Registered, /admin/notifications should show 1 device.',
        );
        return;
      }
      const why =
        r.stage === 'permission'
          ? `Permission is "${r.detail ?? 'denied'}", allow it in Settings → Apps → Sosial → Notifications, then retry.`
          : r.stage === 'no-project'
            ? 'Build has no EAS project id, rebuild from a clean checkout.'
            : r.stage === 'no-token'
              ? `Expo would not mint a token: ${r.detail ?? 'unknown error'} (usually google-services.json missing from this build).`
              : r.stage === 'signed-out'
                ? 'Token minted but you are signed out, sign in to Sosial Cloud first.'
                : `Token minted but the save failed: ${r.detail ?? 'unknown error'}`;
      Alert.alert('Device registration', `Not registered.\n\n${why}`);
    } finally {
      setPushDiagBusy(false);
    }
  };

  useEffect(() => {
    if (view !== 'notif') return;
    let live = true;
    void pushDiagnostics().then((d) => {
      if (live) setPushDiag(d);
    });
    return () => {
      live = false;
    };
  }, [view]);

  /** Counts for the status row (imported ∩ connected). */
  const refreshCloud = async () => {
    try {
      const [meta, flags] = await Promise.all([loadMetaState(), loadCloudChannels()]);
      const connected = connectedChannelIds(meta);
      const fset = new Set(flags);
      setCloudConn(connected.length);
      setCloudImp(connected.filter((c) => fset.has(c)).length);
    } catch {}
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSbState('unconfigured');
      return;
    }
    let live = true;
    void refreshCloud();
    currentSession()
      .then((s) => {
        if (!live) return;
        setSbAccount(s ? { email: s.user.email ?? '', workspace: s.workspace } : null);
        setSbState(s ? 'in' : 'off');
        if (s) void registerPushToken();
      })
      .catch(() => {
        if (live) setSbState('off');
      });
    const unsub = onCloudAuthChange((u) => {
      if (!live) return;
      if (!u) {
        setSbAccount(null);
        setSbState('off');
        void refreshCloud();
        return;
      }
      currentSession()
        .then((s) => {
          if (!live) return;
          setSbAccount(s ? { email: s.user.email ?? '', workspace: s.workspace } : null);
          setSbState(s ? 'in' : 'off');
          // Fresh sign-in activates the master-switch desired state.
          void refreshCloud();
          void syncCloudChannels().then(() => { void refreshCloud(); });
          void registerPushToken();
        })
        .catch(() => {});
    });
    return () => {
      live = false;
      unsub();
    };
  }, []);

  const doCloudSignIn = async () => {
    if (!sbEmail.trim() || !sbPw) {
      setSbErr('Enter your email and password.');
      return;
    }
    setSbBusy(true);
    setSbErr(null);
    setSbNotice(null);
    try {
      const ws = await signInEmail(sbEmail, sbPw);
      setSbAccount({ email: sbEmail.trim(), workspace: ws });
      setSbState('in');
      setSbPw('');
      void syncDownProfile();
    } catch (e: any) {
      setSbErr(e?.message ?? 'Sign-in failed.');
    } finally {
      setSbBusy(false);
    }
  };

  /** Cloud wins after login: restores identity/notifs/team on this device. */
  const syncDownProfile = async () => {
    try {
      const prof = await pullProfileFromCloud();
      if (prof) {
        onUpdate({
          email: prof.email,
          team: prof.team,
          notifPosts: prof.notifPosts,
          notifComments: prof.notifComments,
          notifWeekly: prof.notifWeekly,
        });
      }
    } catch {}
  };

  const doCloudSignUp = async () => {
    if (!sbEmail.trim() || sbPw.length < 6) {
      setSbErr('Enter an email and a password (min 6 characters).');
      return;
    }
    setSbBusy(true);
    setSbErr(null);
    setSbNotice(null);
    try {
      const r = await signUpEmail(sbEmail, sbPw);
      if (r.needsConfirm) {
        setSbNotice('Account created, check your inbox for the confirmation link, then sign in.');
      } else {
        const s = await currentSession();
        setSbAccount(s ? { email: s.user.email ?? '', workspace: s.workspace } : null);
        setSbState(s ? 'in' : 'off');
        void syncDownProfile();
      }
      setSbPw('');
    } catch (e: any) {
      setSbErr(e?.message ?? 'Sign-up failed.');
    } finally {
      setSbBusy(false);
    }
  };

  const doCloudGoogle = async () => {
    // Google Web clients only accept https redirects and Expo Go can only
    // receive exp://, the combination can never complete. Dev builds use the
    // sosial:// scheme and work with the same code path.
    if (Constants.appOwnership === 'expo') {
      Alert.alert(
        'Needs a development build',
        'Google sign-in can’t return to Expo Go. Use email + password here, Google lights up automatically in dev builds.',
      );
      return;
    }
    setSbBusy(true);
    setSbErr(null);
    setSbNotice(null);
    try {
        const ws = await signInWithGoogle();
        const s = await currentSession();
        setSbAccount({ email: s?.user.email ?? '', workspace: ws });
        setSbState('in');
        setSbPw('');
        void syncDownProfile();
    } catch (e: any) {
      setSbErr(e?.message ?? 'Google sign-in failed.');
    } finally {
      setSbBusy(false);
    }
  };

  const doCloudSignOut = () => {
    Alert.alert('Sign out of Sosial Cloud?', 'Your designs stay on this device; the cloud workspace stays intact.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          await signOutCloud();
          setSbAccount(null);
          setSbPw('');
          setSbState('off');
          // Actually leave the app: clearing the session alone would strand
          // the user on the dashboard while signed out.
          onUpdate({ email: '' });
          onLoggedOut();
        },
      },
    ]);
  };

  const planName = plan === 'pro' ? 'Sosial Solo' : plan === 'team' ? 'Sosial Team' : 'Free plan';

  const initial = (email || team || 'Z')[0].toUpperCase();
  const title = view === 'main' ? 'Account' : (
    view === 'notif' ? 'Notifications' : view === 'email' ? 'Email settings' :
    view === 'password' ? 'Change password' : view === 'plan' ? 'Subscription' :
    view === 'changelog' ? "What's new" : view === 'terms' ? 'Terms of use' :
    view === 'report' ? 'Support' : 'Legal'
  );

  const row = (icon: string, label: string, sub: string | undefined, onPress: () => void, danger?: boolean) => (
    <TouchableOpacity onPress={onPress} style={s.row} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={20} color={danger ? C.redText : C.ink} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[s.rowT, danger && { color: C.redText }]}>{label}</Text>
        {sub ? <Text style={s.rowS} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </TouchableOpacity>
  );

  const toggleRow = (label: string, sub: string, value: boolean, onFlip: () => void) => (
    <View style={s.row}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={s.rowT}>{label}</Text>
        <Text style={s.rowS}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onFlip} trackColor={{ true: C.accent, false: '#D8D1BF' }} thumbColor="#ffffff" />
    </View>
  );

  /** Self-serve erasure: typed “confirm” → server wipe → local wipe → signed out. */
  const deleteAccount = async () => {
    if (delWord.trim().toLowerCase() !== 'confirm') {
      Alert.alert('Type “confirm”', 'Type the word “confirm” to delete your data.');
      return;
    }
    setDelBusy(true);
    try {
      const json: any = await callEdgeFunction('delete-account', { confirmation: 'confirm' });
      if (json?.error) throw new Error(String(json.error));
      await wipeAllData();
      await signOutCloud().catch(() => {});
      onLoggedOut();
    } catch (e: any) {
      Alert.alert('Couldn’t delete', e?.message ?? 'Try again.');
    } finally {
      setDelBusy(false);
    }
  };

  const rateApp = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.sosial.app').catch(() => {
      Alert.alert('Rate Sosial', 'Sosial isn’t on the Play Store yet, this link will work after release.');
    });
  };

  /** Load the user's current ticket (one open at a time by design). */
  const loadTicket = async () => {
    try {
      const session = await currentSession();
      if (!session) { setMyTicket(null); return; }
      const { data, error } = await supabase()
        .from('reports')
        .select('id, kind, subject, body, status, admin_note, attachments, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as UserTicket[];
      setMyTicket(rows.find((t) => t.status === 'open' || t.status === 'triaged') ?? null);
    } catch {
      setMyTicket(null);
    }
  };

  /** Pick up to 3 screenshots from the library. */
  const pickShots = async () => {
    if (repShots.length >= 3) {
      Alert.alert('Limit reached', 'Up to 3 screenshots per ticket.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach screenshots.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      selectionLimit: 3 - repShots.length,
    });
    if (r.canceled) return;
    const next = [...repShots];
    for (const a of r.assets) {
      if (next.length >= 3) break;
      next.push({ uri: a.uri, name: a.fileName ?? `screenshot-${Date.now()}.jpg`, mime: a.mimeType ?? 'image/jpeg' });
    }
    setRepShots(next);
  };

  /** Upload picked shots to report-media/<uid>/… (private bucket). */
  const uploadShots = async (reportId: string, uidFolder: string): Promise<string[]> => {
    const paths: string[] = [];
    for (const shot of repShots) {
      const res = await fetch(shot.uri);
      const blob = await res.blob();
      const path = `${uidFolder}/${reportId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase().storage.from('report-media').upload(path, blob, {
        contentType: shot.mime,
        upsert: false,
      });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      paths.push(path);
    }
    return paths;
  };

  /** Owner inbox: bugs, ideas, billing help, straight into the reports table. */
  const sendReport = async () => {
    const body = repBody.trim();
    if (!body) {
      Alert.alert('Nothing to send', 'Describe the problem first.');
      return;
    }
    if (myTicket) {
      Alert.alert('Ticket already open', 'You have an open ticket, we reply there. Once it is resolved you can raise a new one.');
      return;
    }
    setRepBusy(true);
    try {
      const session = await currentSession();
      if (!session) {
        Alert.alert('Sign in first', 'Reports send from your cloud account, sign in to Sosial Cloud at the top of this screen, then retry.');
        return;
      }
      const { data: created, error } = await supabase()
        .from('reports')
        .insert({
          workspace_id: session.workspace.id,
          user_id: session.user.id,
          email: session.user.email ?? '',
          kind: repKind,
          subject: repSubject.trim(),
          body,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      const id = (created as { id: string }).id;
      if (repShots.length > 0) {
        const paths = await uploadShots(id, session.user.id);
        await supabase().from('reports').update({ attachments: paths }).eq('id', id);
      }
      setRepKind('bug');
      setRepSubject('');
      setRepBody('');
      setRepShots([]);
      setView('main');
      Alert.alert('Ticket submitted', 'We reply by email and update the ticket, find it under Support.');
      void loadTicket();
    } catch (e: any) {
      Alert.alert('Couldn’t send', e?.message ?? 'Try again.');
    } finally {
      setRepBusy(false);
    }
  };

  /** Canonical price book (src/utils/plans.ts mirrors the web config). */
  const soloTotal = yearly ? '$120/yr' : '$12/mo';
  const teamTotal = yearly ? '$290/yr' : '$29/mo';
  const businessTotal = yearly ? '$790/yr' : '$79/mo';

  /** Plan switching works today as a local flag; real Play Billing replaces the confirm. */
  const choosePlan = (target: 'free' | 'pro' | 'team', label: string) => {
    if (plan === target) return;
    Alert.alert(`Switch to ${label}?`, target === 'free'
      ? 'You’ll lose paid features on this device.'
      : 'Billing is stubbed in this build, this flips the local plan flag only. Real Play Billing activates at launch.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => onUpdate({ plan: target }) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 132 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => (view === 'main' ? onBack() : setView('main'))} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={[T.h1, { color: C.ink, marginTop: 16, fontSize: 30, lineHeight: 36 }]}>{title}</Text>

        {view === 'main' ? (
          <>
            <View style={[s.list, { marginTop: 16 }]}>
              <View style={s.row}>
                <Ionicons name="moon-outline" size={20} color={C.ink} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={s.rowT}>Dark mode</Text>
                </View>
                <Switch value={mode === 'dark'} onValueChange={toggle} trackColor={{ true: C.accent, false: '#D8D1BF' }} thumbColor="#ffffff" />
              </View>
            </View>
            <View style={s.head}>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Profile picture', pfpUri ? 'Change or remove your picture.' : 'Add a picture, or use your Google account photo.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: pfpUri ? 'Change photo' : 'Add photo', onPress: () => void changePfp() },
                    { text: 'Use Google picture', onPress: () => void useGooglePfp() },
                    ...(pfpUri ? [{ text: 'Remove', style: 'destructive' as const, onPress: () => void removePfp() }] : []),
                  ]);
                }}
                accessibilityLabel="Change profile picture"
                activeOpacity={0.75}
              >
                {pfpUri && !pfpFailed ? (
                  <Image source={{ uri: pfpUri }} onError={() => setPfpFailed(true)} style={[s.avatar, { borderWidth: 0 }]} />
                ) : (
                  <View style={s.avatar}><Text style={s.avatarT}>{initial}</Text></View>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.email} numberOfLines={1}>{email || 'No email set'}</Text>
                <Text style={s.team} numberOfLines={1}>{team}</Text>
              </View>
            </View>
            <View style={s.list}>
              <View style={{ padding: 14, gap: 8 }}>
                <Text style={s.rowT}>Account</Text>
                {sbState === 'checking' ? <Text style={s.rowS}>Checking cloud account…</Text> : null}
                {sbState === 'unconfigured' ? (
                  <Text style={s.rowS}>Backend not configured, add the Supabase keys to .env and restart Expo.</Text>
                ) : null}
                {sbState === 'off' ? (
                  <>
                    <Txt
                      value={sbEmail}
                      onChangeText={(v) => { setSbEmail(v); setSbErr(null); }}
                      placeholder="Email"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <Txt
                      value={sbPw}
                      onChangeText={(v) => { setSbPw(v); setSbErr(null); }}
                      placeholder="Password (min 6 chars)"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {sbErr ? <Text style={{ color: C.redText }}>{sbErr}</Text> : null}
                    {sbNotice ? <Text style={s.rowS}>{sbNotice}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <GhostBtn label={sbBusy ? '…' : 'Sign in'} onPress={() => { if (!sbBusy) void doCloudSignIn(); }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <GhostBtn label={sbBusy ? '…' : 'Create account'} onPress={() => { if (!sbBusy) void doCloudSignUp(); }} />
                      </View>
                    </View>
                    <GhostBtn label={sbBusy ? '…' : 'Continue with Google'} onPress={() => { if (!sbBusy) void doCloudGoogle(); }} />
                    <Text style={s.rowS}>One account per email. Your workspace syncs across devices.</Text>
                  </>
                ) : null}
                {sbState === 'in' && sbAccount ? (
                  <>
                    <Text style={s.rowS} numberOfLines={1}>
                      {sbAccount.email} · {sbAccount.workspace.name} ({sbAccount.workspace.role})
                    </Text>
                    <GhostBtn label="Sign out" danger onPress={doCloudSignOut} />
                  </>
                ) : null}
              </View>
            </View>
            <View style={s.list}>
              {row('notifications-outline', 'Notification settings', 'Post reminders, comments, digest', () => setView('notif'))}
              {row('mail-outline', 'Email settings', email || 'Set your email', () => { setDraftEmail(email); setDraftTeam(team); setView('email'); })}
              {row('key-outline', 'Change password', undefined, () => { setPw1(''); setPw2(''); setView('password'); })}
            </View>
            <View style={s.list}>
              {row('add-circle-outline', 'Connect new channel', 'Facebook, Instagram, Threads', onConnect)}
              {row(
                'cloud-upload-outline',
                'Cloud publishing',
                sbState !== 'in'
                  ? 'Always on, sign in to Sosial Cloud to activate'
                  : cloudConn === 0
                    ? 'Always on, connect a channel and it uploads automatically'
                    : `Always on · ${cloudImp} of ${cloudConn} channel${cloudConn === 1 ? '' : 's'} in cloud`,
                () => Alert.alert(
                  'Cloud publishing',
                  'Always on: connecting a channel stores an encrypted copy of its tokens so scheduled posts publish while the app is closed. To revoke a channel, disconnect it in Connect.',
                ),
              )}
              {row('card-outline', 'Subscription plan', planName, () => setView('plan'))}
              {row('people-outline', 'Team', 'Members, invites & switching', onTeam)}
              {row('refresh-outline', 'Restore purchase', undefined, () => Alert.alert('Restore purchase', 'No purchases found on this device.'))}
              {row('star-outline', 'Rate Sosial', 'Review on the Play Store', rateApp)}
              {row('chatbubble-ellipses-outline', 'Support', myTicket ? 'Open ticket, we are on it' : 'Bugs, questions, billing help', () => {
                setRepKind('bug');
                setRepSubject('');
                setRepBody('');
                setRepShots([]);
                setView('report');
                void loadTicket();
              })}
              {row('sparkles-outline', "What's new", 'Changelog', () => setView('changelog'))}
            </View>
            <View style={s.list}>
              {row('shield-checkmark-outline', 'Privacy policy', undefined, onPrivacy)}
              {row('document-text-outline', 'Terms of use', undefined, () => setView('terms'))}
              {row('scale-outline', 'Legal', undefined, () => setView('legal'))}
              {row('trash-outline', 'Delete my data', 'Erase your account everywhere', () => { setDelArmed(false); setDelWord(''); setView('delete'); }, true)}
            </View>
          </>
        ) : null}

        {view === 'notif' ? (
          <View style={s.list}>
            {toggleRow('Post reminders', 'Alert when a queued post is due', notifPosts, () => onUpdate({ notifPosts: !notifPosts }))}
            {toggleRow('Comments & mentions', 'Alert on new comments (installed app)', notifComments, () => onUpdate({ notifComments: !notifComments }))}
            {toggleRow('Weekly digest', 'A Monday summary of your channels', notifWeekly, () => onUpdate({ notifWeekly: !notifWeekly }))}
            <Text style={s.note}>Reminder alerts need the installed app (not Expo Go) with notifications allowed.</Text>
            <View style={{ padding: 14, paddingTop: 6, gap: 8 }}>
              <Text style={s.rowS}>
                Owner pushes:{' '}
                {pushDiag
                  ? `${pushDiag.permission}${pushDiag.token ? ' · token OK' : ' · no token'}${pushDiag.projectId ? '' : ' · EAS project missing'}`
                  : 'checking…'}
              </Text>
              <GhostBtn
                label={pushDiagBusy ? '…' : 'Retry device registration'}
                onPress={() => {
                  if (!pushDiagBusy) void retryPush();
                }}
              />
            </View>
          </View>
        ) : null}

        {view === 'email' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <View>
              <Text style={s.label}>Email</Text>
              <Txt value={draftEmail} onChangeText={setDraftEmail} placeholder="you@studio.com" keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View>
              <Text style={s.label}>Team / organization</Text>
              <Txt value={draftTeam} onChangeText={setDraftTeam} placeholder="My team" />
            </View>
            <TouchableOpacity
              onPress={() => { onUpdate({ email: draftEmail.trim(), team: draftTeam.trim() || 'My team' }); setView('main'); }}
              style={s.save} activeOpacity={0.85}
            >
              <Text style={s.saveT}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {view === 'delete' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <Text style={[s.rowT, { color: C.redText }]}>This permanently erases your account.</Text>
            <Text style={s.note}>
              {'\u2022'} Workspaces you own are deleted whole, posts, drafts, media, channels and tokens.{'\n'}
              {'\u2022'} Teammates in those workspaces lose access too.{'\n'}
              {'\u2022'} Memberships in other people's workspaces are removed.{'\n'}
              {'\u2022'} Media-source tokens (Drive, Photos, Dropbox, Canva) are revoked.{'\n'}
              {'\u2022'} Cancel any paid subscription first.
            </Text>
            {!delArmed ? (
              <GhostBtn label="I understand, continue" danger onPress={() => setDelArmed(true)} />
            ) : (
              <>
                <View>
                  <Text style={s.label}>Type “confirm” to delete everything</Text>
                  <Txt value={delWord} onChangeText={setDelWord} placeholder="confirm" autoCapitalize="none" autoCorrect={false} />
                </View>
                <GhostBtn
                  label={delBusy ? 'Deleting…' : 'Delete my data forever'}
                  danger
                  onPress={() => { if (!delBusy) void deleteAccount(); }}
                />
              </>
            )}
          </View>
        ) : null}

        {view === 'password' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <Text style={s.note}>Sosial accounts live on this device only, there’s no cloud password. Your social accounts keep their own passwords with Meta. Setting one here just confirms it’s you on this phone.</Text>
            <View>
              <Text style={s.label}>New password</Text>
              <Txt value={pw1} onChangeText={setPw1} placeholder="••••••••" secureTextEntry />
            </View>
            <View>
              <Text style={s.label}>Confirm</Text>
              <Txt value={pw2} onChangeText={setPw2} placeholder="••••••••" secureTextEntry />
            </View>
            <TouchableOpacity
              onPress={() => {
                if (pw1.length < 4) Alert.alert('Too short', 'Use at least 4 characters.');
                else if (pw1 !== pw2) Alert.alert('No match', 'The two passwords differ.');
                else { setPw1(''); setPw2(''); setView('main'); Alert.alert('Saved', 'Password updated on this device.'); }
              }}
              style={s.save} activeOpacity={0.85}
            >
              <Text style={s.saveT}>Update password</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {view === 'report' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            {myTicket ? (
              <>
                <View style={[s.plan, { gap: 6 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[s.pill, { backgroundColor: C.accentSoft }]}><Text style={[s.pillT, { color: C.accentInk }]}>
                      {myTicket.status === 'open' ? 'Open' : 'In review'}
                    </Text></View>
                    <Text style={s.note}>{new Date(myTicket.created_at).toLocaleDateString()}</Text>
                  </View>
                  {myTicket.subject ? <Text style={s.rowT}>{myTicket.subject}</Text> : null}
                  <Text style={s.note}>{myTicket.body}</Text>
                </View>
                {myTicket.admin_note ? (
                  <View style={[s.plan, { backgroundColor: C.card, gap: 4 }]}>
                    <Text style={s.label}>Reply from Sosial support</Text>
                    <Text style={s.note}>{myTicket.admin_note}</Text>
                  </View>
                ) : (
                  <Text style={s.note}>We reply by email and update this ticket, you will hear from us shortly.</Text>
                )}
                {myTicket.attachments?.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {myTicket.attachments.map((p) => (
                      <TicketShot key={p} path={p} />
                    ))}
                  </View>
                ) : null}
                <Text style={s.note}>
                  One ticket at a time keeps the conversation in one place. It is erased with its screenshots 30 days after being resolved.
                </Text>
                <GhostBtn label="Refresh" onPress={() => void loadTicket()} />
              </>
            ) : (
              <>
                <Text style={s.note}>Describe what happened, screenshots help. We reply by email and you can follow the ticket here. Resolved tickets are erased with attachments after 30 days.</Text>
                <Seg<ReportKind>
                  options={[
                    { value: 'bug', label: 'Bug' },
                    { value: 'idea', label: 'Idea' },
                    { value: 'billing', label: 'Billing' },
                    { value: 'other', label: 'Other' },
                  ]}
                  value={repKind}
                  onChange={setRepKind}
                />
                <View>
                  <Text style={s.label}>Subject (optional)</Text>
                  <Txt value={repSubject} onChangeText={setRepSubject} placeholder="Short summary" />
                </View>
                <View>
                  <Text style={s.label}>Details</Text>
                  <Txt value={repBody} onChangeText={setRepBody} placeholder="What happened? What did you expect?" multiline style={{ minHeight: 120 }} />
                </View>
                {repShots.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {repShots.map((shot, i) => (
                      <View key={`${shot.uri}-${i}`}>
                        <Image source={{ uri: shot.uri }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                        <TouchableOpacity
                          onPress={() => setRepShots(repShots.filter((_, j) => j !== i))}
                          style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}
                          accessibilityLabel={`Remove ${shot.name}`}
                        >
                          <Text style={{ color: C.paper, fontSize: 12, lineHeight: 14 }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
                <GhostBtn label={`Attach screenshots (${repShots.length}/3)`} onPress={() => void pickShots()} />
                <TouchableOpacity
                  onPress={() => { if (!repBusy) void sendReport(); }}
                  style={s.save} activeOpacity={0.85}
                >
                  <Text style={s.saveT}>{repBusy ? 'Sending…' : 'Submit ticket'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {view === 'plan' ? (
          <View style={{ marginTop: 16, gap: 14 }}>
            {/* current plan at a glance */}
            <View style={[s.plan, { borderColor: C.accent, borderWidth: 1.5, gap: 4 }]}>
              <Text style={s.planEyebrow}>Your plan</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.planName}>{planName}</Text>
                <View style={s.pill}><Text style={s.pillT}>Current</Text></View>
              </View>
              <Text style={s.planPrice}>{plan === 'free' ? 'Free forever' : plan === 'pro' ? soloTotal : teamTotal}</Text>
              {plan !== 'free' ? (
                <View style={{ marginTop: 8 }}>
                  <GhostBtn label="Manage subscription" onPress={() => Alert.alert('Manage subscription', 'Subscriptions are managed in the Play Store app under Payments & subscriptions.')} />
                </View>
              ) : null}
            </View>

            {/* billing rhythm, interval changes price + renewal only, never limits */}
            <View style={[s.plan, { gap: 12 }]}>
              <Field label="Billing">
                <Seg
                  options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly · 2 months free' }]}
                  value={yearly ? 'yearly' : 'monthly'}
                  onChange={(v) => setYearly(v === 'yearly')}
                />
              </Field>
            </View>

            <PlanCard
              name="Free"
              current={plan === 'free'}
              price="Free"
              features={[
                { text: '3 connected channels' },
                { text: '10 scheduled posts per channel' },
                { text: '20 AI credits a month' },
                { text: 'Calendar, queue and auto-publishing' },
                { text: 'Sosial watermark (required)', off: true },
              ]}
              action={plan !== 'free' ? { label: 'Switch to Free', ghost: true, onPress: () => choosePlan('free', 'Free') } : undefined}
            />

            <PlanCard
              name="Solo"
              current={plan === 'pro'}
              price={soloTotal}
              sub={yearly ? '≈ $10/mo equivalent, billed yearly' : 'Billed monthly'}
              also="Everything in Free, plus:"
              features={[
                { text: '6 connected channels' },
                { text: 'Unlimited scheduled posts' },
                { text: '500 AI credits a month' },
                { text: 'Media library and content organization' },
                { text: 'Watermark you control, turn it off' },
              ]}
              action={plan === 'free'
                ? { label: `Upgrade to Solo · ${soloTotal}`, onPress: () => choosePlan('pro', 'Solo') }
                : plan === 'team'
                  ? { label: 'Switch to Solo', ghost: true, onPress: () => choosePlan('pro', 'Solo') }
                  : undefined}
            />

            <PlanCard
              name="Team"
              current={plan === 'team'}
              price={teamTotal}
              sub={yearly ? '≈ $25/mo equivalent, billed yearly' : 'Billed monthly'}
              also="Everything in Solo, plus:"
              features={[
                { text: '25 connected channels' },
                { text: 'Unlimited scheduled posts' },
                { text: '1,500 AI credits a month' },
                { text: '5 team members and 3 workspaces' },
                { text: 'Approval workflows and roles' },
              ]}
              action={plan === 'free'
                ? { label: `Upgrade to Team · ${teamTotal}`, ghost: true, onPress: () => choosePlan('team', 'Team') }
                : plan === 'pro'
                  ? { label: `Switch to Team · ${teamTotal}`, onPress: () => choosePlan('team', 'Team') }
                  : undefined}
            />

            <PlanCard
              name="Business"
              current={false}
              price={businessTotal}
              sub={yearly ? '≈ $66/mo equivalent, billed yearly' : 'Billed monthly'}
              also="Everything in Team, plus:"
              features={[
                { text: '100 connected channels' },
                { text: 'Unlimited scheduled posts' },
                { text: '5,000 AI credits a month' },
                { text: 'Unlimited team members, 6 workspaces' },
              ]}
              action={{ label: 'Business activates with Play Billing', ghost: true, onPress: () => Alert.alert('Business', 'Business purchases activate with Play Billing at launch, the web app supports it today.') }}
            />
          </View>
        ) : null}



        {view === 'changelog' ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            {CHANGELOG.map((c) => (
              <View key={c.v} style={s.plan}>
                <Text style={s.planT}>v{c.v}</Text>
                {c.notes.map((n, i) => (
                  <Text key={i} style={s.planS}>• {n}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {view === 'terms' ? (
          <View style={{ marginTop: 16 }}>
            <Text style={s.body}>{TERMS_TEXT}</Text>
          </View>
        ) : null}

        {view === 'legal' ? (
          <View style={{ marginTop: 16 }}>
            <Text style={s.body}>
              © 2026 Sosial. All rights reserved.{'\n\n'}
              Facebook, Instagram and Threads are trademarks of Meta Platforms, Inc. This app is not affiliated with or endorsed by Meta.{'\n\n'}
              Open-source licenses for bundled libraries are available in the project repository.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Signed-URL shot from the private report-media bucket. */
function TicketShot({ path }: { path: string }) {
  const { C } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error } = await supabase().storage.from('report-media').createSignedUrl(path, 3600);
        if (!alive) return;
        setUri(error || !data?.signedUrl ? null : data.signedUrl);
      } catch {
        if (alive) setUri(null);
      }
    })();
    return () => { alive = false; };
  }, [path]);
  if (!uri) return <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: C.surface }} />;
  return <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 10 }} />;
}

/** One plan, scannable: name + price anchor, short checkmark list, one action. */
function PlanCard({ name, current, price, sub, also, features, action }: {
  name: string;
  current: boolean;
  price: string;
  sub?: string;
  also?: string;
  features: { text: string; off?: boolean }[];
  action?: { label: string; ghost?: boolean; onPress: () => void };
}) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={[s.plan, current && { borderColor: C.accent, borderWidth: 1.5 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={s.planT}>{name}</Text>
        {current ? <View style={s.pill}><Text style={s.pillT}>Current</Text></View> : null}
      </View>
      <Text style={s.planPrice}>{price}</Text>
      {sub ? <Text style={s.planSub}>{sub}</Text> : null}
      {also ? <Text style={s.planAlso}>{also}</Text> : null}
      <View style={{ gap: 7, marginTop: 6 }}>
        {features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Ionicons name={f.off ? 'close-circle-outline' : 'checkmark-circle'} size={15} color={f.off ? C.faint : C.greenText} style={{ marginTop: 2 }} />
            <Text style={[s.planFeat, f.off && { color: C.faint }]}>{f.text}</Text>
          </View>
        ))}
      </View>
      {action ? (
        <View style={{ marginTop: 10 }}>
          {action.ghost ? (
            <GhostBtn label={action.label} onPress={action.onPress} />
          ) : (
            <TouchableOpacity onPress={action.onPress} style={s.save} activeOpacity={0.85}>
              <Text style={s.saveT}>{action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  avatarT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: C.onInk },
  email: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, letterSpacing: -0.2, color: C.ink },
  team: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted },
  list: { backgroundColor: C.card, borderRadius: R.lg, overflow: 'hidden', marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.lineSoft },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 1 },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.soft, marginBottom: 7 },
  save: { backgroundColor: C.ink, borderRadius: R.md + 2, paddingVertical: 12, alignItems: 'center' },
  saveT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.onInk },
  note: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted, margin: 14 },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 19, color: C.muted },
  plan: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: 16, gap: 6 },

  planT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: C.ink },
  currentTag: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.accent, marginTop: 6 },
  planS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20, color: C.muted },
  planEyebrow: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: C.muted },
  planName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, letterSpacing: -0.3, color: C.ink },
  planPrice: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, letterSpacing: -0.4, color: C.ink, marginTop: 2 },
  planSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted },
  planAlso: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 4 },
  planFeat: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20, color: C.soft, flex: 1 },
  pill: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.accentInk },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22, color: C.soft },
});
