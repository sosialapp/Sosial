import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, Switch, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { Txt, Field, Seg, GhostBtn } from '../components/ui';
import * as WebBrowser from 'expo-web-browser';
import { isRunningInExpoGo } from 'expo';
import { wipeAllData } from '../utils/account';
import { TERMS_TEXT } from '../utils/legal';
import { supabase, currentSession, signUpEmail, signInEmail, signInWithGoogle, signOutCloud, onCloudAuthChange, isSupabaseConfigured, pullProfileFromCloud, callEdgeFunction, WorkspaceInfo, getMyAvatar, avatarSignedUrl, setAvatarFromUri, clearMyAvatar } from '../utils/supabase';
import { ADMIN_LOCALES, LOCALE_NAMES } from '../utils/account';
import { tr } from '../i18n';
import { loadMetaState, connectedChannelIds } from '../utils/metaStore';
import { loadCloudChannels, syncCloudChannels } from '../utils/cloudChannels';
import { registerPushToken, registerPushTokenFull, pushDiagnostics, type PushDiag } from '../utils/pushTokens';

WebBrowser.maybeCompleteAuthSession();

type AcctView = 'main' | 'notif' | 'email' | 'password' | 'plan' | 'changelog' | 'terms' | 'legal' | 'report' | 'delete' | 'lang';

type ReportKind = 'bug' | 'idea' | 'billing' | 'other';

const CHANGELOG = [
  { v: '1.0.0', notes: ['Buffer-style app: Create, Post and Analytics tabs', 'Ideas feed with design-studio link', 'Queue / drafts / approvals / sent pipeline', 'Per-channel insights, top posts and comments', 'Meta login via secure bridge page'] },
];

/** Account settings: notifications, email, password, plan, legal… (all on-device, no backend). */
export default function AccountScreen({ email, team, plan, notifPosts, notifComments, notifWeekly, notifMarketing, locale, onUpdate, onBack, onConnect, onPrivacy, onLoggedOut, onTeam }: {
  email: string;
  team: string;
  plan: 'free' | 'pro' | 'team';
  notifPosts: boolean;
  notifComments: boolean;
  notifWeekly: boolean;
  notifMarketing: boolean;
  locale: string;
  onUpdate: (patch: { email?: string; team?: string; plan?: 'free' | 'pro' | 'team'; notifPosts?: boolean; notifComments?: boolean; notifWeekly?: boolean; notifMarketing?: boolean; locale?: string }) => void;
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
      Alert.alert(tr('uPermissionNeeded'), tr('uAllowPhotoAccessTo'));
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
      Alert.alert(tr('uUpdated'), tr('uProfilePictureSaved'));
    } catch (e: any) {
      Alert.alert(tr('uCouldnTUpdate'), e?.message ?? tr('uTryAgain'));
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
      Alert.alert(tr('uUpdated'), tr('uUsingYourGoogleProfile'));
    } catch (e: any) {
      Alert.alert(tr('uNotAvailable'), e?.message ?? tr('uNoGooglePictureOn'));
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
      setSbErr(tr('uEnterYourEmailAnd'));
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
      setSbErr(e?.message ?? tr('wErrIn'));
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
          notifMarketing: prof.notifMarketing,
          locale: prof.locale,
        });
      }
    } catch {}
  };

  const doCloudSignUp = async () => {
    if (!sbEmail.trim() || sbPw.length < 6) {
      setSbErr(tr('wErrNeed'));
      return;
    }
    setSbBusy(true);
    setSbErr(null);
    setSbNotice(null);
    try {
      const r = await signUpEmail(sbEmail, sbPw);
      if (r.needsConfirm) {
        setSbNotice(tr('wNoticeConfirm'));
      } else {
        const s = await currentSession();
        setSbAccount(s ? { email: s.user.email ?? '', workspace: s.workspace } : null);
        setSbState(s ? 'in' : 'off');
        void syncDownProfile();
      }
      setSbPw('');
    } catch (e: any) {
      setSbErr(e?.message ?? tr('wErrUp'));
    } finally {
      setSbBusy(false);
    }
  };

  const doCloudGoogle = async () => {
    // Google Web clients only accept https redirects and Expo Go can only
    // receive exp://, the combination can never complete. Dev builds use the
    // sosial:// scheme and work with the same code path.
    if (isRunningInExpoGo()) {
      Alert.alert(
        tr('wGoogleAlertT'),
        tr('wGoogleAlertB'),
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
      setSbErr(e?.message ?? tr('wErrGoogle'));
    } finally {
      setSbBusy(false);
    }
  };

  const doCloudSignOut = () => {
    Alert.alert(tr('uSignOutOfSosial'), tr('uYourDesignsStayOn'), [
      { text: tr('uCancel'), style: 'cancel' },
      {
        text: tr('aSignOut'),
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

  const planName = plan === 'pro' ? 'Sosial Solo' : plan === 'team' ? 'Sosial Team' : tr('aFree');

  const initial = (email || team || 'Z')[0].toUpperCase();
  const title = view === 'main' ? tr('aTitle') : (
    view === 'notif' ? tr('aNotifTitle') : view === 'email' ? tr('aEmail') :
    view === 'lang' ? tr('aLang') :
    view === 'password' ? tr('aPw') : view === 'plan' ? tr('aPlanTitle') :
    view === 'changelog' ? tr('aNew') : view === 'terms' ? tr('aTerms') :
    view === 'report' ? tr('aSupport') : tr('aLegal')
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
      Alert.alert(tr('uTypeConfirm'), tr('uTypeTheWordConfirm'));
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
      Alert.alert(tr('uCouldnTDelete'), e?.message ?? tr('uTryAgain'));
    } finally {
      setDelBusy(false);
    }
  };

  const rateApp = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.sosial.app').catch(() => {
      Alert.alert(tr('aRate'), tr('uSosialIsnTOn'));
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
      Alert.alert(tr('uLimitReached'), tr('uUpTo3Screenshots'));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(tr('uPermissionNeeded'), tr('uAllowPhotoAccessTo2'));
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
      Alert.alert(tr('uNothingToSend'), tr('uDescribeTheProblemFirst'));
      return;
    }
    if (myTicket) {
      Alert.alert(tr('uTicketAlreadyOpen'), tr('uYouHaveAnOpen'));
      return;
    }
    setRepBusy(true);
    try {
      const session = await currentSession();
      if (!session) {
        Alert.alert(tr('uSignInFirst'), tr('uReportsSendFromYour'));
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
      Alert.alert(tr('uTicketSubmitted'), tr('uWeReplyByEmail'));
      void loadTicket();
    } catch (e: any) {
      Alert.alert(tr('uCouldnTSend'), e?.message ?? tr('uTryAgain'));
    } finally {
      setRepBusy(false);
    }
  };

  /** Canonical price book (src/utils/plans.ts mirrors the web config). */
  const soloMo = yearly ? '$10' : '$12';
  const teamMo = yearly ? '$25' : '$29';
  const businessMo = yearly ? '$66' : '$79';

  /** Plan switching works today as a local flag; real Play Billing replaces the confirm. */
  const choosePlan = (target: 'free' | 'pro' | 'team', label: string) => {
    if (plan === target) return;
    Alert.alert(tr('pbSwitchQ').replace('{plan}', label), target === 'free'
      ? tr('uYouLlLosePaid')
      : 'Billing is stubbed in this build, this flips the local plan flag only. Real Play Billing activates at launch.', [
      { text: tr('uCancel'), style: 'cancel' },
      { text: tr('uConfirm'), onPress: () => onUpdate({ plan: target }) },
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
                  <Text style={s.rowT}>{tr('aDark')}</Text>
                </View>
                <Switch value={mode === 'dark'} onValueChange={toggle} trackColor={{ true: C.accent, false: '#D8D1BF' }} thumbColor="#ffffff" />
              </View>
              <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => { setView('lang'); }}>
                <Ionicons name="globe-outline" size={20} color={C.ink} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={s.rowT}>{tr('aLang')}</Text>
                </View>
                <Text style={s.rowS} numberOfLines={1}>{LOCALE_NAMES[locale] ?? locale}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.faint ?? C.ink} />
              </TouchableOpacity>
            </View>
            <View style={s.head}>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(tr('uProfilePicture'), pfpUri ? tr('uChangeOrRemoveYour') : tr('uAddAPictureOr'), [
                    { text: tr('uCancel'), style: 'cancel' },
                    { text: pfpUri ? tr('uChangePhoto') : tr('uAddPhoto'), onPress: () => void changePfp() },
                    { text: tr('uUseGooglePicture'), onPress: () => void useGooglePfp() },
                    ...(pfpUri ? [{ text: tr('uRemove'), style: 'destructive' as const, onPress: () => void removePfp() }] : []),
                  ]);
                }}
                accessibilityLabel={tr('uChangeProfilePicture')}
                activeOpacity={0.75}
              >
                {pfpUri && !pfpFailed ? (
                  <Image source={{ uri: pfpUri }} onError={() => setPfpFailed(true)} style={[s.avatar, { borderWidth: 0 }]} />
                ) : (
                  <View style={s.avatar}><Text style={s.avatarT}>{initial}</Text></View>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.email} numberOfLines={1}>{email || tr('uNoEmailSet')}</Text>
                <Text style={s.team} numberOfLines={1}>{team}</Text>
              </View>
            </View>
            <View style={s.list}>
              <View style={{ padding: 14, gap: 8 }}>
                <Text style={s.rowT}>{tr('aTitle')}</Text>
                {sbState === 'checking' ? <Text style={s.rowS}>{tr('uCheckingCloudAccount')}</Text> : null}
                {sbState === 'unconfigured' ? (
                  <Text style={s.rowS}>Backend not configured, add the Supabase keys to .env and restart Expo.</Text>
                ) : null}
                {sbState === 'off' ? (
                  <>
                    <Txt
                      value={sbEmail}
                      onChangeText={(v) => { setSbEmail(v); setSbErr(null); }}
                      placeholder={tr('wEmailPh')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <Txt
                      value={sbPw}
                      onChangeText={(v) => { setSbPw(v); setSbErr(null); }}
                      placeholder={tr('wPwPh')}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {sbErr ? <Text style={{ color: C.redText }}>{sbErr}</Text> : null}
                    {sbNotice ? <Text style={s.rowS}>{sbNotice}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <GhostBtn label={sbBusy ? '…' : tr('aSignIn')} onPress={() => { if (!sbBusy) void doCloudSignIn(); }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <GhostBtn label={sbBusy ? '…' : tr('aSignUp')} onPress={() => { if (!sbBusy) void doCloudSignUp(); }} />
                      </View>
                    </View>
                    <GhostBtn label={sbBusy ? '…' : tr('aGoogle')} onPress={() => { if (!sbBusy) void doCloudGoogle(); }} />
                    <Text style={s.rowS}>{tr('uOneAccountPerEmail')}</Text>
                  </>
                ) : null}
                {sbState === 'in' && sbAccount ? (
                  <>
                    <Text style={s.rowS} numberOfLines={1}>
                      {sbAccount.email} · {sbAccount.workspace.name} ({sbAccount.workspace.role})
                    </Text>
                    <GhostBtn label={tr('aSignOut')} danger onPress={doCloudSignOut} />
                  </>
                ) : null}
              </View>
            </View>
            <View style={s.list}>
              {row('notifications-outline', tr('aNotifs'), tr('aNotifsS'), () => setView('notif'))}
              {row('mail-outline', tr('aEmail'), email || tr('aEmailSet'), () => { setDraftEmail(email); setDraftTeam(team); setView('email'); })}
              {row('key-outline', tr('aPw'), undefined, () => { setPw1(''); setPw2(''); setView('password'); })}
            </View>
            <View style={s.list}>
              {row('add-circle-outline', tr('aConnect'), 'Facebook, Instagram, Threads', onConnect)}
              {row(
                'cloud-upload-outline',
                tr('aCloud'),
                sbState !== 'in'
                  ? tr('uAlwaysOnSignIn')
                  : cloudConn === 0
                    ? tr('uAlwaysOnConnectA')
                    : `Always on · ${cloudImp} of ${cloudConn} channel${cloudConn === 1 ? '' : 's'} in cloud`,
                () => Alert.alert(
                  tr('aCloud'),
                  tr('uAlwaysOnConnectingA'),
                ),
              )}
              {row('card-outline', tr('aPlan'), planName, () => setView('plan'))}
              {row('people-outline', tr('aTeam'), tr('aTeamS'), onTeam)}
              {row('refresh-outline', tr('aRestore'), undefined, () => Alert.alert(tr('aRestore'), tr('uNoPurchasesFoundOn')))}
              {row('star-outline', tr('aRate'), tr('aRateS'), rateApp)}
              {row('chatbubble-ellipses-outline', tr('aSupport'), myTicket ? tr('aSupportOpen') : tr('aSupportS'), () => {
                setRepKind('bug');
                setRepSubject('');
                setRepBody('');
                setRepShots([]);
                setView('report');
                void loadTicket();
              })}
              {row('sparkles-outline', tr('aNew'), tr('aChangelog'), () => setView('changelog'))}
            </View>
            <View style={s.list}>
              {row('shield-checkmark-outline', tr('aPrivacy'), undefined, onPrivacy)}
              {row('document-text-outline', tr('aTerms'), undefined, () => setView('terms'))}
              {row('scale-outline', tr('aLegal'), undefined, () => setView('legal'))}
              {row('trash-outline', tr('aDelete'), tr('aDeleteS'), () => { setDelArmed(false); setDelWord(''); setView('delete'); }, true)}
            </View>
          </>
        ) : null}

        {view === 'notif' ? (
          <View style={s.list}>
            {toggleRow(tr('aRemind'), tr('aRemindS'), notifPosts, () => onUpdate({ notifPosts: !notifPosts }))}
            {toggleRow(tr('aComm'), tr('aCommS'), notifComments, () => onUpdate({ notifComments: !notifComments }))}
            {toggleRow(tr('aWeekly'), tr('aWeeklyS'), notifWeekly, () => onUpdate({ notifWeekly: !notifWeekly }))}
            {toggleRow(tr('aProduct'), tr('aProductS'), notifMarketing, () => onUpdate({ notifMarketing: !notifMarketing }))}
            <Text style={s.note}>{tr('uReminderAlertsNeedThe')}</Text>
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

        {view === 'lang' ? (
          <View style={s.list}>
            {ADMIN_LOCALES.map((l) => (
              <TouchableOpacity
                key={l}
                style={s.row}
                activeOpacity={0.7}
                onPress={() => { onUpdate({ locale: l }); setView('main'); }}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[s.rowT, l === locale && { fontWeight: '700' as const }]}>{LOCALE_NAMES[l]}</Text>
                </View>
                {l === locale ? (
                  <Ionicons name="checkmark" size={18} color={C.accent} />
                ) : null}
              </TouchableOpacity>
            ))}
            <Text style={s.note}>{tr('aLangNote')}</Text>
          </View>
        ) : null}

        {view === 'email' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <View>
              <Text style={s.label}>{tr('wEmailPh')}</Text>
              <Txt value={draftEmail} onChangeText={setDraftEmail} placeholder="you@studio.com" keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View>
              <Text style={s.label}>{tr('uTeamOrganization')}</Text>
              <Txt value={draftTeam} onChangeText={setDraftTeam} placeholder="My team" />
            </View>
            <TouchableOpacity
              onPress={() => { onUpdate({ email: draftEmail.trim(), team: draftTeam.trim() || tr('uMyTeam') }); setView('main'); }}
              style={s.save} activeOpacity={0.85}
            >
              <Text style={s.saveT}>{tr('uSave')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {view === 'delete' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <Text style={[s.rowT, { color: C.redText }]}>{tr('uThisPermanentlyErasesYour')}</Text>
            <Text style={s.note}>
              {tr('uDelNote')}
            </Text>
            {!delArmed ? (
              <GhostBtn label={tr('uIUnderstandContinue')} danger onPress={() => setDelArmed(true)} />
            ) : (
              <>
                <View>
                  <Text style={s.label}>{tr('uTypeConfirmToDelete')}</Text>
                  <Txt value={delWord} onChangeText={setDelWord} placeholder="confirm" autoCapitalize="none" autoCorrect={false} />
                </View>
                <GhostBtn
                  label={delBusy ? tr('uDeleting') : tr('uDeleteMyDataForever')}
                  danger
                  onPress={() => { if (!delBusy) void deleteAccount(); }}
                />
              </>
            )}
          </View>
        ) : null}

        {view === 'password' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <Text style={s.note}>{tr('uPwNote')}</Text>
            <View>
              <Text style={s.label}>{tr('uNewPassword')}</Text>
              <Txt value={pw1} onChangeText={setPw1} placeholder="••••••••" secureTextEntry />
            </View>
            <View>
              <Text style={s.label}>{tr('uConfirm')}</Text>
              <Txt value={pw2} onChangeText={setPw2} placeholder="••••••••" secureTextEntry />
            </View>
            <TouchableOpacity
              onPress={() => {
                if (pw1.length < 4) Alert.alert(tr('uTooShort'), tr('uUseAtLeast4'));
                else if (pw1 !== pw2) Alert.alert(tr('uNoMatch'), tr('uTheTwoPasswordsDiffer'));
                else { setPw1(''); setPw2(''); setView('main'); Alert.alert(tr('uSaved'), tr('uPasswordUpdatedOnThis')); }
              }}
              style={s.save} activeOpacity={0.85}
            >
              <Text style={s.saveT}>{tr('uUpdatePassword')}</Text>
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
                      {myTicket.status === 'open' ? tr('uOpen') : tr('uInReview')}
                    </Text></View>
                    <Text style={s.note}>{new Date(myTicket.created_at).toLocaleDateString()}</Text>
                  </View>
                  {myTicket.subject ? <Text style={s.rowT}>{myTicket.subject}</Text> : null}
                  <Text style={s.note}>{myTicket.body}</Text>
                </View>
                {myTicket.admin_note ? (
                  <View style={[s.plan, { backgroundColor: C.card, gap: 4 }]}>
                    <Text style={s.label}>{tr('uReplyFromSosialSupport')}</Text>
                    <Text style={s.note}>{myTicket.admin_note}</Text>
                  </View>
                ) : (
                  <Text style={s.note}>{tr('uWeReplyByEmail2')}</Text>
                )}
                {myTicket.attachments?.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {myTicket.attachments.map((p) => (
                      <TicketShot key={p} path={p} />
                    ))}
                  </View>
                ) : null}
                <Text style={s.note}>
                  {tr('uOneTicketAtA')}
                </Text>
                <GhostBtn label={tr('uRefresh')} onPress={() => void loadTicket()} />
              </>
            ) : (
              <>
                <Text style={s.note}>{tr('uDescribeWhatHappenedScreens')}</Text>
                <Seg<ReportKind>
                  options={[
                    { value: 'bug', label: tr('uBug') },
                    { value: 'idea', label: tr('uIdea') },
                    { value: 'billing', label: tr('uBilling') },
                    { value: 'other', label: tr('uOther') },
                  ]}
                  value={repKind}
                  onChange={setRepKind}
                />
                <View>
                  <Text style={s.label}>{tr('uSubjectOptional')}</Text>
                  <Txt value={repSubject} onChangeText={setRepSubject} placeholder={tr('uShortSummary')} />
                </View>
                <View>
                  <Text style={s.label}>{tr('uDetails')}</Text>
                  <Txt value={repBody} onChangeText={setRepBody} placeholder={tr('uWhatHappenedWhatDid')} multiline style={{ minHeight: 120 }} />
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
                  <Text style={s.saveT}>{repBusy ? tr('uSending') : tr('uSubmitTicket')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {view === 'plan' ? (
          <View style={{ marginTop: 16, gap: 14 }}>
            {/* current plan, in its card's pastel */}
            <View style={[s.pcCard, { borderWidth: 1, borderColor: C.lineSoft }]}>
              <View style={[s.pcHead, { backgroundColor: TONES[plan].bg, minHeight: 0 }]}>
                <Text style={[s.pcEyebrow, { color: TONES[plan].sub }]}>{tr('uYourPlan')}</Text>
                <Text style={[s.pcBigName, { color: TONES[plan].ink }]}>{planName}</Text>
              </View>
              <View style={{ padding: 16, gap: 10 }}>
                <View>
                  <Text style={s.pcPrice}>
                    {plan === 'free' ? tr('uFree') : tr('pbPerMo').replace('{price}', plan === 'pro' ? soloMo : teamMo)}
                  </Text>
                  <Text style={s.pcSub}>{plan === 'free' ? tr('uFreeForever') : yearly ? tr('pbBilledYearly').replace('{price}', plan === 'pro' ? '$120' : '$290') : tr('uBilledMonthly')}</Text>
                </View>
                {plan !== 'free' ? (
                  <GhostBtn label={tr('uManageSubscription')} onPress={() => Alert.alert(tr('uManageSubscription'), tr('uSubscriptionsAreManagedIn'))} />
                ) : null}
              </View>
            </View>

            {/* billing rhythm: changes price and renewal only, never limits */}
            <Seg
              options={[{ value: 'monthly', label: tr('uMonthly') }, { value: 'yearly', label: tr('uYearly2MonthsFree') }]}
              value={yearly ? 'yearly' : 'monthly'}
              onChange={(v) => setYearly(v === 'yearly')}
            />

            <PlanCard
              name={tr('uFree')}
              blurb={tr('pbFree')}
              tone={TONES.free}
              current={plan === 'free'}
              price={tr('uFree')}
              sub={tr('uFreeForever')}
              quota={[tr('u3ConnectedChannels'), tr('u20AiCreditsA')]}
              features={[
                { text: tr('u10ScheduledPostsPer') },
                { text: tr('uCalendarQueueAndAuto') },
                { text: tr('uSosialWatermarkRequired'), off: true },
              ]}
              action={plan !== 'free' ? { label: tr('pbSwitchTo').replace('{plan}', tr('uFree')), ghost: true, onPress: () => choosePlan('free', tr('uFree')) } : undefined}
            />

            <PlanCard
              name="Solo"
              blurb={tr('pbSolo')}
              tone={TONES.pro}
              current={plan === 'pro'}
              price={tr('pbPerMo').replace('{price}', soloMo)}
              sub={yearly ? tr('pbBilledYearly').replace('{price}', '$120') : tr('uBilledMonthly')}
              quota={[tr('u6ConnectedChannels'), tr('u500AiCreditsA')]}
              also={tr('uEverythingInFreePlus')}
              features={[
                { text: tr('uUnlimitedScheduledPosts') },
                { text: tr('uMediaLibraryAndContent') },
                { text: tr('uWatermarkYouControlTurn') },
              ]}
              action={plan === 'pro' ? undefined : {
                label: (plan === 'free' ? tr('pbChoose') : tr('pbSwitchTo')).replace('{plan}', 'Solo'),
                ghost: plan === 'team',
                onPress: () => choosePlan('pro', 'Solo'),
              }}
            />

            <PlanCard
              name="Team"
              blurb={tr('pbTeam')}
              tone={TONES.team}
              featured
              current={plan === 'team'}
              price={tr('pbPerMo').replace('{price}', teamMo)}
              sub={yearly ? tr('pbBilledYearly').replace('{price}', '$290') : tr('uBilledMonthly')}
              quota={[tr('u25ConnectedChannels'), tr('u1500AiCredits')]}
              also={tr('uEverythingInSoloPlus')}
              features={[
                { text: tr('u5TeamMembersAnd') },
                { text: tr('uApprovalWorkflowsAndRoles') },
              ]}
              action={plan === 'team' ? undefined : {
                label: tr('pbChoose').replace('{plan}', 'Team'),
                onPress: () => choosePlan('team', 'Team'),
              }}
            />

            <PlanCard
              name="Business"
              blurb={tr('pbBusiness')}
              tone={TONES.business}
              current={false}
              price={tr('pbPerMo').replace('{price}', businessMo)}
              sub={yearly ? tr('pbBilledYearly').replace('{price}', '$790') : tr('uBilledMonthly')}
              quota={[tr('u100ConnectedChannels'), tr('u5000AiCredits')]}
              also={tr('uEverythingInTeamPlus')}
              features={[
                { text: tr('uUnlimitedTeamMembers6') },
              ]}
              action={{ label: tr('uBusinessActivatesWithPlay'), ghost: true, onPress: () => Alert.alert('Business', tr('uBusinessPurchasesActivateWi')) }}
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
              {tr('uOpenSourceLicensesFor')}
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
/** Pastel header tints from the web pricing cards; dark ink reads on all four. */
const TONES = {
  free: { bg: '#DCE6FF', ink: '#1E2B5C', sub: '#42507E' },
  pro: { bg: '#D6EFE0', ink: '#16452C', sub: '#2F5C42' },
  team: { bg: '#F9DCEF', ink: '#5E1147', sub: '#7E3B68' },
  business: { bg: '#E6DEFB', ink: '#3A2A66', sub: '#5A4B86' },
};
type Tone = (typeof TONES)['free'];

/** One plan, laid out like the web pricing card: pastel header, big price,
 *  two quota fields, dot bullets and a full-width button. */
function PlanCard({ name, blurb, tone, current, featured, price, sub, quota, also, features, action }: {
  name: string;
  blurb: string;
  tone: Tone;
  current: boolean;
  featured?: boolean;
  price: string;
  sub?: string;
  quota: [string, string];
  also?: string;
  features: { text: string; off?: boolean }[];
  action?: { label: string; ghost?: boolean; onPress: () => void };
}) {
  const { C } = useTheme();
  const s = makeS(C);
  return (
    <View style={[s.pcCard, current && { borderWidth: 2, borderColor: C.ink }]}>
      <View style={[s.pcHead, { backgroundColor: tone.bg }]}>
        {current || featured ? (
          <View style={s.pcBadge}>
            <Text style={[s.pcBadgeT, { color: tone.ink }]}>{current ? tr('pbCurrentPlan') : tr('pbPopular')}</Text>
          </View>
        ) : null}
        <Text style={[s.pcName, { color: tone.ink }]}>{name}</Text>
        <Text style={[s.pcBlurb, { color: tone.sub }]}>{blurb}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 }}>
        <Text style={s.pcPrice}>{price}</Text>
        {sub ? <Text style={s.pcSub}>{sub}</Text> : null}
        <View style={{ gap: 8, marginTop: 14 }}>
          <View style={s.pcField}>
            <Ionicons name="sparkles" size={14} color="#3b82f6" />
            <Text style={s.pcFieldT} numberOfLines={1}>{quota[0]}</Text>
          </View>
          <View style={s.pcField}>
            <Ionicons name="layers-outline" size={15} color="#3f9e6b" />
            <Text style={s.pcFieldT} numberOfLines={1}>{quota[1]}</Text>
          </View>
        </View>
        {also ? <Text style={s.pcAlso}>{also}</Text> : null}
        <View style={{ gap: 6, marginTop: also ? 6 : 14 }}>
          {features.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
              <View style={[s.pcDot, f.off && { backgroundColor: C.line }]} />
              <Text style={[s.pcFeat, f.off && { color: C.faint }]}>{f.text}</Text>
            </View>
          ))}
        </View>
        {action ? (
          <View style={{ marginTop: 16 }}>
            {action.ghost ? (
              <GhostBtn label={action.label} onPress={action.onPress} />
            ) : (
              <TouchableOpacity onPress={action.onPress} style={s.save} activeOpacity={0.85}>
                <Text style={s.saveT}>{action.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : current ? (
          <View style={[s.pcActive, { marginTop: 16 }]}>
            <Ionicons name="checkmark-circle" size={16} color={C.greenText} />
            <Text style={s.pcActiveT}>{tr('pbActive')}</Text>
          </View>
        ) : null}
      </View>
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
  pcCard: { backgroundColor: C.card, borderRadius: 28, overflow: 'hidden' },
  pcHead: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 18, minHeight: 104 },
  pcEyebrow: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase' },
  pcBigName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, letterSpacing: -0.6, marginTop: 4 },
  pcBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  pcBadgeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5 },
  pcName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, letterSpacing: -0.2, paddingRight: 110 },
  pcBlurb: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18, marginTop: 3 },
  pcPrice: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, letterSpacing: -0.8, color: C.ink },
  pcSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 3 },
  pcField: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 12 },
  pcFieldT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, color: C.ink, flex: 1 },
  pcAlso: { fontFamily: 'PlusJakartaSans_400Regular', fontStyle: 'italic', fontSize: 12, color: C.muted, marginTop: 14 },
  pcDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.faint, marginTop: 8 },
  pcFeat: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 19, color: C.soft, flex: 1 },
  pcActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: R.md + 2, borderWidth: 1, borderColor: C.lineSoft, paddingVertical: 11 },
  pcActiveT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink },
  pill: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.accentInk },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22, color: C.soft },
});
