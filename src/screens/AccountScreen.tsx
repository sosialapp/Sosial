import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { Txt, Field, Stepper, Seg, GhostBtn } from '../components/ui';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { wipeAllData } from '../utils/account';
import { TERMS_TEXT } from '../utils/legal';
import { currentSession, signUpEmail, signInEmail, signInWithGoogle, signOutCloud, onCloudAuthChange, isSupabaseConfigured, pullProfileFromCloud, WorkspaceInfo } from '../utils/supabase';
import { loadMetaState, connectedChannelIds } from '../utils/metaStore';
import { loadCloudChannels, syncCloudChannels } from '../utils/cloudChannels';

WebBrowser.maybeCompleteAuthSession();

type AcctView = 'main' | 'notif' | 'email' | 'password' | 'plan' | 'changelog' | 'terms' | 'legal';

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
  const { C } = useTheme();
  const s = makeS(C);
  const [view, setView] = useState<AcctView>('main');
  const [proChannels, setProChannels] = useState(3);
  const [yearly, setYearly] = useState(true);
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftTeam, setDraftTeam] = useState(team);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  /* Sosial Cloud (Supabase staging) — real accounts live alongside the legacy
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
        setSbNotice('Account created — check your inbox for the confirmation link, then sign in.');
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
    // receive exp:// — the combination can never complete. Dev builds use the
    // sosial:// scheme and work with the same code path.
    if (Constants.appOwnership === 'expo') {
      Alert.alert(
        'Needs a development build',
        'Google sign-in can’t return to Expo Go. Use email + password here — Google lights up automatically in dev builds.',
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

  const planName = plan === 'pro' ? 'Sosial Pro' : plan === 'team' ? 'Sosial Team' : 'Free plan';

  const initial = (email || team || 'Z')[0].toUpperCase();
  const title = view === 'main' ? 'Account' : (
    view === 'notif' ? 'Notifications' : view === 'email' ? 'Email settings' :
    view === 'password' ? 'Change password' : view === 'plan' ? 'Subscription' :
    view === 'changelog' ? "What's new" : view === 'terms' ? 'Terms of use' : 'Legal'
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

  const deleteAccount = () => {
    Alert.alert('Delete Sosial account?', 'This wipes everything on this device: designs, templates, ideas, posts, channels and settings. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything', style: 'destructive',
        onPress: () => Alert.alert('Last chance', 'Really delete all Sosial data?', [
          { text: 'Keep it', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { await wipeAllData(); onLoggedOut(); } },
        ]),
      },
    ]);
  };

  const rateApp = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.sosial.app').catch(() => {
      Alert.alert('Rate Sosial', 'Sosial isn’t on the Play Store yet — this link will work after release.');
    });
  };

  const proTotal = yearly ? `$${49 * proChannels}/yr` : `$${(4.99 * proChannels).toFixed(2)}/mo`;
  const teamTotal = yearly ? `$${99 * proChannels}/yr` : `$${(9.99 * proChannels).toFixed(2)}/mo`;

  /** Plan switching works today as a local flag; real Play Billing replaces the confirm. */
  const choosePlan = (target: 'free' | 'pro' | 'team', label: string) => {
    if (plan === target) return;
    Alert.alert(`Switch to ${label}?`, target === 'free'
      ? 'You’ll lose paid features on this device.'
      : 'Billing is stubbed in this build — this flips the local plan flag only. Real Play Billing activates at launch.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => onUpdate({ plan: target }) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => (view === 'main' ? onBack() : setView('main'))} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={[T.h1, { color: C.ink, marginTop: 16, fontSize: 30, lineHeight: 36 }]}>{title}</Text>

        {view === 'main' ? (
          <>
            <View style={s.head}>
              <View style={s.avatar}><Text style={s.avatarT}>{initial}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.email} numberOfLines={1}>{email || 'No email set'}</Text>
                <Text style={s.team} numberOfLines={1}>{team}</Text>
              </View>
            </View>
            <View style={s.list}>
              <View style={{ padding: 14, gap: 8 }}>
                <Text style={s.rowT}>Sosial Cloud (staging)</Text>
                {sbState === 'checking' ? <Text style={s.rowS}>Checking cloud account…</Text> : null}
                {sbState === 'unconfigured' ? (
                  <Text style={s.rowS}>Backend not configured — add the Supabase keys to .env and restart Expo.</Text>
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
                  ? 'Always on — sign in to Sosial Cloud to activate'
                  : cloudConn === 0
                    ? 'Always on — connect a channel and it uploads automatically'
                    : `Always on · ${cloudImp} of ${cloudConn} channel${cloudConn === 1 ? '' : 's'} in cloud`,
                () => Alert.alert(
                  'Cloud publishing',
                  'Always on: connecting a channel stores an encrypted copy of its tokens so scheduled posts publish while the app is closed. To revoke a channel, disconnect it in Connect.',
                ),
              )}
              {row('card-outline', 'Subscription plan', planName, () => setView('plan'))}
              {plan === 'team' ? row('people-outline', 'Team', 'Roles, channels & invites', onTeam) : null}
              {row('refresh-outline', 'Restore purchase', undefined, () => Alert.alert('Restore purchase', 'No purchases found on this device.'))}
              {row('star-outline', 'Rate Sosial', 'Review on the Play Store', rateApp)}
              {row('sparkles-outline', "What's new", 'Changelog', () => setView('changelog'))}
            </View>
            <View style={s.list}>
              {row('shield-checkmark-outline', 'Privacy policy', undefined, onPrivacy)}
              {row('document-text-outline', 'Terms of use', undefined, () => setView('terms'))}
              {row('scale-outline', 'Legal', undefined, () => setView('legal'))}
              {row('trash-outline', 'Delete Sosial account', 'Wipe everything on-device', deleteAccount, true)}
            </View>
          </>
        ) : null}

        {view === 'notif' ? (
          <View style={s.list}>
            {toggleRow('Post reminders', 'Alert when a queued post is due', notifPosts, () => onUpdate({ notifPosts: !notifPosts }))}
            {toggleRow('Comments & mentions', 'Alert on new comments (installed app)', notifComments, () => onUpdate({ notifComments: !notifComments }))}
            {toggleRow('Weekly digest', 'A Monday summary of your channels', notifWeekly, () => onUpdate({ notifWeekly: !notifWeekly }))}
            <Text style={s.note}>Reminder alerts need the installed app (not Expo Go) with notifications allowed.</Text>
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

        {view === 'password' ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <Text style={s.note}>Sosial accounts live on this device only — there’s no cloud password. Your social accounts keep their own passwords with Meta. Setting one here just confirms it’s you on this phone.</Text>
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

        {view === 'plan' ? (
          <View style={{ marginTop: 16, gap: 14 }}>
            {/* current plan at a glance */}
            <View style={[s.plan, { borderColor: C.accent, borderWidth: 1.5, gap: 4 }]}>
              <Text style={s.planEyebrow}>Your plan</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.planName}>{planName}</Text>
                <View style={s.pill}><Text style={s.pillT}>Current</Text></View>
              </View>
              <Text style={s.planPrice}>{plan === 'free' ? 'Free forever' : plan === 'pro' ? proTotal : teamTotal}</Text>
              {plan !== 'free' ? (
                <View style={{ marginTop: 8 }}>
                  <GhostBtn label="Manage subscription" onPress={() => Alert.alert('Manage subscription', 'Subscriptions are managed in the Play Store app under Payments & subscriptions.')} />
                </View>
              ) : null}
            </View>

            {/* one tuner for both paid plans */}
            <View style={[s.plan, { gap: 12 }]}>
              <Field label="Billing">
                <Seg
                  options={[{ value: 'yearly', label: 'Yearly · save ~20%' }, { value: 'monthly', label: 'Monthly' }]}
                  value={yearly ? 'yearly' : 'monthly'}
                  onChange={(v) => setYearly(v === 'yearly')}
                />
              </Field>
              <Field label="Channels" hint={`${proChannels} channel${proChannels === 1 ? '' : 's'} — applies to Pro & Team`}>
                <Stepper value={proChannels} onChange={setProChannels} step={1} min={1} max={10} format={(v) => `${v}`} />
              </Field>
            </View>

            <PlanCard
              name="Free"
              current={plan === 'free'}
              price="Free"
              features={[
                { text: '2 connected channels · 10 scheduled posts each' },
                { text: 'Unlimited studio, templates & ideas' },
                { text: '7-day analytics' },
                { text: 'AI generation', off: true },
              ]}
              action={plan !== 'free' ? { label: 'Switch to Free', ghost: true, onPress: () => choosePlan('free', 'Free') } : undefined}
            />

            <PlanCard
              name="Sosial Pro"
              current={plan === 'pro'}
              price={proTotal}
              sub={yearly ? `$4.08/mo per channel · RM ${219 * proChannels}/yr` : `$4.99/mo per channel · RM ${(21.9 * proChannels).toFixed(2)}/mo`}
              also="Everything in Free, plus:"
              features={[
                { text: 'Unlimited scheduled posts' },
                { text: 'Approval workflow' },
                { text: 'No export badge' },
                { text: '500 AI generations / month' },
                { text: '1-year analytics + comments' },
              ]}
              action={plan === 'free'
                ? { label: `Upgrade to Pro · ${proTotal}`, onPress: () => choosePlan('pro', `Sosial Pro (${proTotal})`) }
                : plan === 'team'
                  ? { label: 'Switch to Pro', ghost: true, onPress: () => choosePlan('pro', 'Sosial Pro') }
                  : undefined}
            />

            <PlanCard
              name="Sosial Team"
              current={plan === 'team'}
              price={teamTotal}
              sub={yearly ? `$8.25/mo per channel · RM ${439 * proChannels}/yr` : `$9.99/mo per channel · RM ${(43.9 * proChannels).toFixed(2)}/mo`}
              also="Everything in Pro, plus:"
              features={[
                { text: 'Unlimited seats for the whole crew' },
                { text: 'Per-channel member roles' },
                { text: '1,000 AI generations / month' },
                { text: 'Priority support' },
              ]}
              action={plan === 'free'
                ? { label: `Upgrade to Team · ${teamTotal}`, ghost: true, onPress: () => choosePlan('team', `Sosial Team (${teamTotal})`) }
                : plan === 'pro'
                  ? { label: `Switch to Team · ${teamTotal}`, onPress: () => choosePlan('team', `Sosial Team (${teamTotal})`) }
                  : undefined}
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
