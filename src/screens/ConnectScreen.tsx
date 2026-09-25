import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { SocialGlyph, Txt, ChannelAvatar, AccountStack } from '../components/ui';
import { SOCIAL_META } from '../constants';
import { META_APP_ID, IG_APP_ID } from '../utils/metaConfig';
import { loadAccounts, removeAccount, saveProviderFields, makeAccount } from '../utils/metaStore';
import { accountName, accountAvatar, isCloudOnly, metaFromAccounts, type ConnectedAccount, type ProviderKey } from '../utils/socialAccounts';
import {
  loginFacebook, exchangeFacebookCode, fetchPages, pickPage, FbPage,
  loginInstagram, exchangeInstagramCode, fetchInstagramProfile,
  loginThreads, exchangeThreadsCode, fetchThreadsProfile,
} from '../utils/metaAuth';
import { loginTikTok, completeTikTokLogin } from '../utils/tiktokAuth';
import { loginX, completeXLogin } from '../utils/xAuth';
import { X_CLIENT_ID } from '../utils/xConfig';
import { completeBskyLogin } from '../utils/bskyAuth';
import { loginMastodon, completeMastodonLogin } from '../utils/mastodonAuth';
import { loginLinkedIn, completeLiLogin, listMyLiOrgs, pickLiOrg, LiOrg } from '../utils/liAuth';
import { LI_CLIENT_ID } from '../utils/liConfig';
import { loginYouTube, completeYtLogin } from '../utils/ytAuth';
import { YT_CLIENT_ID } from '../utils/ytConfig';
import { loginPinterest, completePinLogin } from '../utils/pinAuth';
import { PIN_CLIENT_ID } from '../utils/pinConfig';
import { listPinBoards, PinBoard } from '../utils/pinPublish';
import { BUILD_TAG } from '../utils/build';
import { loadCloudTeam } from '../utils/teamCloud';
import { disableCloudChannel, syncCloudChannels, pullCloudChannels, removeCloudChannelAccount } from '../utils/cloudChannels';
import { currentSession } from '../utils/supabase';
import { subscribeAuthResult, flushAuthResults, clearPendingAuth, getPendingAuth, wasCodeDone, markCodeDone, AuthResult } from '../utils/authFlow';
import { backfillMissingAvatars } from '../utils/avatarBackfill';
import { TT_CLIENT_KEY } from '../utils/tiktokConfig';

const PROVIDERS: ProviderKey[] = ['facebook', 'instagram', 'threads', 'tiktok', 'x', 'bluesky', 'mastodon', 'linkedin', 'youtube', 'pinterest'];

function ChannelIcon({ platform }: { platform: string }) {
  return <ChannelAvatar platform={platform} size={56} badge={false} />;
}

/** One compact row per provider — tap to connect, tap again to manage its accounts. */
export default function ConnectScreen({ onBack, onTeam }: { onBack: () => void; onTeam: () => void }) {
  const { C } = useTheme();
  const s = makeS(C);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const meta = useMemo(() => metaFromAccounts(accounts), [accounts]);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  /** Workspace-wide removal is owner-only (enforced by remove-channel-token too). */
  const [isOwner, setIsOwner] = useState(false);
  const [pages, setPages] = useState<FbPage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [openProvider, setOpenProvider] = useState<ProviderKey | null>(null);
  const [bskyHandle, setBskyHandle] = useState('');
  const [bskyPass, setBskyPass] = useState('');
  const [mastodonInstance, setMastodonInstance] = useState('');
  const [pinBoards, setPinBoards] = useState<PinBoard[] | null>(null);
  const [pinBoardsLoading, setPinBoardsLoading] = useState(false);
  const [liOrgs, setLiOrgs] = useState<LiOrg[]>([]);
  const [selId, setSelId] = useState<Partial<Record<ProviderKey, string>>>({});

  useEffect(() => {
    // Backfill first so the push below already carries fresh pictures, then
    // push local channels up and pull cloud-only channels down — one visit
    // converges both directions before the list paints.
    void (async () => {
      await backfillMissingAvatars().catch(() => null);
      // Force: this screen exists to reflect the cloud — never serve a stale
      // throttled pull here. Pull BEFORE pushing so an account the owner
      // disconnected elsewhere is retracted locally first and never re-imported.
      await pullCloudChannels(true).catch(() => null);
      await syncCloudChannels().catch(() => null);
      setAccounts(await loadAccounts().catch(() => []));
    })();
    loadCloudTeam()
      .then((t) => {
        setTeamCount(t ? Math.max(0, t.members.length - 1) : 0);
        setIsOwner(t ? t.myRole === 'owner' : false);
      })
      .catch(() => setTeamCount(0));
    currentSession()
      .then((sn) => setIsOwner(sn ? sn.workspace.role === 'owner' : false))
      .catch(() => {});
  }, []);

  // Master-switch reconciler: any credential change auto-imports (master on)
  // or stays inert (master off / signed out). Idempotent — safe per change.
  useEffect(() => {
    void syncCloudChannels();
  }, [meta]);

  const completeRef = useRef<(r: AuthResult) => void>(() => {});
  const lastCodeRef = useRef<string | null>(null);
  // Synchronous in-flight claim: the same return URL can arrive twice in the
  // same tick (browser-session result + OS link event). Providers burn codes
  // on first redeem, so without this both redemptions run and the loser pops
  // a scary "login failed" over an already-connected account.
  const claimingRef = useRef<Set<string>>(new Set());

  /** Finishes an OAuth login no matter which app instance received the code —
   *  the one that opened the browser, or a fresh one after Expo Go reloaded. */
  const completeAuth = async (r: AuthResult) => {
    // the same return URL can arrive twice (browser-session result + OS link
    // event, or a replay after an Expo Go reload) — providers burn codes on
    // first redeem, so a second exchange of the same code always fails with
    // "authorization code was invalid"
    if (r.code) {
      if (lastCodeRef.current === r.code || claimingRef.current.has(r.code)) {
        await clearPendingAuth();
        return;
      }
      claimingRef.current.add(r.code);
      lastCodeRef.current = r.code;
      if (await wasCodeDone(r.code)) {
        await clearPendingAuth();
        return;
      }
    }
    if (r.error) {
      await clearPendingAuth();
      setBusy(null);
      Alert.alert('Login cancelled', r.error);
      return;
    }
    if (!r.code) {
      await clearPendingAuth();
      setBusy(null);
      return;
    }
    setBusy('Exchanging token…');
    try {
      if (r.channel === 'facebook') {
        const token = await exchangeFacebookCode(r.code);
        await saveProviderFields('facebook', {
          fbUserToken: token,
          pageId: undefined, pageName: undefined, pageToken: undefined,
        }, r.accountId);
        setAccounts(await loadAccounts());
        const pgs = await fetchPages(token);
        setPages(pgs);
        setOpenProvider('facebook');
        setSelId((s) => ({ ...s, facebook: r.accountId ?? 'acct_facebook' }));
        if (pgs.length === 0) {
          Alert.alert('No Pages found', 'Create a Facebook Page you manage first — posts publish as the Page.');
        }
      } else if (r.channel === 'instagram') {
        const { token, userId } = await exchangeInstagramCode(r.code);
        let name: string | undefined;
        let id = userId;
        let avatar: string | undefined;
        try {
          const prof = await fetchInstagramProfile(token);
          id = prof.id || userId;
          name = prof.username;
          avatar = prof.picture;
        } catch {}
        await saveProviderFields('instagram', { igToken: token, igId: id, igName: name, avatar }, r.accountId);
        setAccounts(await loadAccounts());
      } else if (r.channel === 'threads') {
        const { token, userId } = await exchangeThreadsCode(r.code);
        let name: string | undefined;
        let avatar: string | undefined;
        try {
          const prof = await fetchThreadsProfile(token);
          name = prof.username;
          avatar = prof.picture;
        } catch {}
        await saveProviderFields('threads', { threadsToken: token, threadsId: userId, threadsName: name, avatar }, r.accountId);
        setAccounts(await loadAccounts());
      } else if (r.channel === 'tiktok') {
        const { name } = await completeTikTokLogin(r.code, r.accountId);
        setAccounts(await loadAccounts());
        setOpenProvider('tiktok');
        if (!name) Alert.alert('Connected', 'TikTok connected — we couldn’t read the display name yet.');
      } else if (r.channel === 'x') {
        const { name } = await completeXLogin(r.code, r.accountId);
        setAccounts(await loadAccounts());
        setOpenProvider('x');
        if (!name) Alert.alert('Connected', 'X connected — we couldn’t read the handle yet.');
      } else if (r.channel === 'mastodon') {
        const { name } = await completeMastodonLogin(r.code, r.accountId);
        setAccounts(await loadAccounts());
        setOpenProvider('mastodon');
        if (!name) Alert.alert('Connected', 'Mastodon connected — we couldn’t read the handle yet.');
      } else if (r.channel === 'linkedin') {
        const { name } = await completeLiLogin(r.code, r.accountId);
        setAccounts(await loadAccounts());
        setOpenProvider('linkedin');
        setSelId((s) => ({ ...s, linkedin: r.accountId ?? 'acct_linkedin' }));
        try {
          const orgs = await listMyLiOrgs(r.accountId ?? 'acct_linkedin');
          setLiOrgs(orgs);
          if (orgs.length === 0) {
            Alert.alert('No Company Pages found', 'Posting as yourself — admin a LinkedIn Page to post as the business.');
          }
        } catch {
          // org list needs the Marketing Developer Platform product; member
          // posting + stats still work, the picker just stays empty.
        }
        if (!name) Alert.alert('Connected', 'LinkedIn connected — we couldn’t read the name yet.');
      } else if (r.channel === 'youtube') {
        const { name } = await completeYtLogin(r.code, r.accountId);
        setAccounts(await loadAccounts());
        setOpenProvider('youtube');
        if (!name) Alert.alert('Connected', 'YouTube connected — we couldn’t read the channel yet.');
      } else if (r.channel === 'pinterest') {
        const { name } = await completePinLogin(r.code, r.accountId);
        const accts = await loadAccounts();
        setAccounts(accts);
        setOpenProvider('pinterest');
        const pid = r.accountId ?? 'acct_pinterest';
        setSelId((s) => ({ ...s, pinterest: pid }));
        setPinBoards(null);
        const acct = accts.find((a) => a.id === pid);
        if (acct) void loadPinBoardsFor(acct);
        if (!name) Alert.alert('Connected', 'Pinterest connected — we couldn’t read the handle yet. Pick a board below.');
      }
      if (r.code) await markCodeDone(r.code);
    } catch (e: any) {
      const label = r.channel[0].toUpperCase() + r.channel.slice(1);
      Alert.alert(`${label} login failed`, e?.message ?? 'Try again.');
    } finally {
      await clearPendingAuth();
      setBusy(null);
    }
  };
  completeRef.current = completeAuth;

  useEffect(() => {
    const unsub = subscribeAuthResult((r) => { void completeRef.current(r); });
    flushAuthResults((r) => { void completeRef.current(r); });
    getPendingAuth().then((ch) => { if (ch) setBusy('Waiting for login…'); });
    return unsub;
  }, []);

  const backedOut = (label: string) => {
    setBusy(null);
    Alert.alert(
      `${label} login closed`,
      'If the browser showed a login page instead of a permission screen, sign in there — after that one sign-in, Connect goes straight through every time.'
    );
  };

  const doFacebook = async (accountId?: string) => {
    setBusy('Opening Facebook…');
    if (!(await loginFacebook(accountId))) backedOut('Facebook');
  };

  const doInstagram = async (accountId?: string) => {
    setBusy('Opening Instagram…');
    if (!(await loginInstagram(accountId))) backedOut('Instagram');
  };

  const doThreads = async (accountId?: string) => {
    setBusy('Opening Threads…');
    if (!(await loginThreads(accountId))) backedOut('Threads');
  };

  const loadPagesFor = async (acct: ConnectedAccount) => {
    const tok = acct.fields.fbUserToken as string | undefined;
    if (!tok) { setPages([]); return; }
    setBusy('Loading Pages…');
    try {
      setPages(await fetchPages(tok));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not load Pages.');
    } finally {
      setBusy(null);
    }
  };

  const disconnectAccount = async (account: ConnectedAccount) => {
    if (isCloudOnly(account)) {
      // Placeholder only — the live channel belongs to another device, so
      // just drop the local row. Never run the cloud sweep here: it would
      // revoke the other device's working channel.
      setAccounts(await removeAccount(account.id));
      return;
    }
    // Disconnect revokes the cloud copy too — provider-wide sweep when it's the
    // last account (precise external_id removal lands with Slice 4).
    const remaining = accounts.filter((a) => a.provider === account.provider && a.id !== account.id);
    if (remaining.length === 0) void disableCloudChannel(account.provider, meta);
    setAccounts(await removeAccount(account.id));
    setOpenProvider(null);
    if (account.provider === 'facebook') setPages([]);
    if (account.provider === 'pinterest') setPinBoards(null);
    if (account.provider === 'linkedin') setLiOrgs([]);
  };

  /**
   * Remove a cloud-synced account for the whole workspace: deletes the cloud
   * channel (and its stored tokens), then the local placeholder. This is the
   * path that makes cloud-owned channels removable — without it they are
   * locked to the workspace forever.
   */
  const removeCloudAccount = async (account: ConnectedAccount) => {
    Alert.alert(
      'Remove everywhere?',
      'This deletes the cloud channel and its stored tokens for the whole workspace. Scheduled posts for it pause until you reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCloudChannelAccount(account);
            } catch (e: any) {
              Alert.alert('Failed', e?.message ?? 'Could not remove the account.');
              return;
            }
            setAccounts(await removeAccount(account.id));
          },
        },
      ],
    );
  };

  const doTikTok = async (accountId?: string) => {
    if (!ttConfigured) {
      Alert.alert('Keys missing', 'TikTok client key is empty — check .env, then restart Expo (env loads at startup).');
      return;
    }
    setBusy('Opening TikTok…');
    if (!(await loginTikTok(accountId))) backedOut('TikTok');
  };

  const doX = async (accountId?: string) => {
    if (!xConfigured) {
      Alert.alert('Keys missing', 'Paste the X Client ID into .env first, then reload.');
      return;
    }
    setBusy('Opening X…');
    if (!(await loginX(accountId))) backedOut('X');
  };

  const doBsky = async (accountId?: string) => {
    setBusy('Connecting Bluesky…');
    try {
      const { name } = await completeBskyLogin(bskyHandle, bskyPass, accountId);
      setBskyPass('');
      setAccounts(await loadAccounts());
      setOpenProvider('bluesky');
      if (!name) Alert.alert('Connected', 'Bluesky connected.');
    } catch (e: any) {
      Alert.alert('Bluesky login failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doMastodon = async (accountId?: string) => {
    setBusy('Opening Mastodon…');
    try {
      if (!(await loginMastodon(mastodonInstance, accountId))) backedOut('Mastodon');
    } catch (e: any) {
      setBusy(null);
      Alert.alert('Mastodon login failed', e?.message ?? 'Try again.');
    }
  };

  const doLinkedin = async (accountId?: string) => {
    if (!liConfigured) {
      Alert.alert('Keys missing', 'Paste the Client ID + secret into .env first, then reload.');
      return;
    }
    setBusy('Opening LinkedIn…');
    try {
      if (!(await loginLinkedIn(accountId))) backedOut('LinkedIn');
    } catch (e: any) {
      setBusy(null);
      Alert.alert('LinkedIn login failed', e?.message ?? 'Try again.');
    }
  };

  const loadLiOrgsFor = async (acct: ConnectedAccount) => {
    setBusy('Loading Pages…');
    try {
      setLiOrgs(await listMyLiOrgs(acct.id));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not load Company Pages.');
    } finally {
      setBusy(null);
    }
  };

  const doYoutube = async (accountId?: string) => {
    if (!ytConfigured) {
      Alert.alert('Keys missing', 'Paste the Client ID + secret into .env first, then reload.');
      return;
    }
    setBusy('Opening Google…');
    try {
      if (!(await loginYouTube(accountId))) backedOut('YouTube');
    } catch (e: any) {
      setBusy(null);
      Alert.alert('YouTube login failed', e?.message ?? 'Try again.');
    }
  };

  const doPinterest = async (accountId?: string) => {
    if (!pinConfigured) {
      Alert.alert('Keys missing', 'Paste the App ID + secret into .env first, then reload.');
      return;
    }
    setBusy('Opening Pinterest…');
    try {
      if (!(await loginPinterest(accountId))) backedOut('Pinterest');
    } catch (e: any) {
      setBusy(null);
      Alert.alert('Pinterest login failed', e?.message ?? 'Try again.');
    }
  };

  const loadPinBoardsFor = async (acct: ConnectedAccount) => {
    setPinBoardsLoading(true);
    try {
      const boards = await listPinBoards(acct.id);
      setPinBoards(boards);
      if (boards.length === 0) Alert.alert('No boards yet', 'Create a board in Pinterest first, then pick it here.');
    } catch (e: any) {
      Alert.alert('Couldn’t load boards', e?.message ?? 'Try again.');
    } finally {
      setPinBoardsLoading(false);
    }
  };

  const pickPinBoard = async (b: PinBoard, accountId: string) => {
    await saveProviderFields('pinterest', { pinBoardId: b.id, pinBoardName: b.name }, accountId);
    setAccounts(await loadAccounts());
  };

  const configured = META_APP_ID.length > 0;
  const ttConfigured = TT_CLIENT_KEY.length > 0 && !TT_CLIENT_KEY.startsWith('PASTE_');
  const xConfigured = X_CLIENT_ID.length > 0 && !X_CLIENT_ID.startsWith('PASTE_');
  const liConfigured = LI_CLIENT_ID.length > 0 && !LI_CLIENT_ID.startsWith('PASTE_');
  const ytConfigured = YT_CLIENT_ID.length > 0 && !YT_CLIENT_ID.startsWith('PASTE_');
  const pinConfigured = PIN_CLIENT_ID.length > 0 && !PIN_CLIENT_ID.startsWith('PASTE_');

  const providerCfg: Record<ProviderKey, { label: string; manual: boolean; configured: boolean; connect: (accountId?: string) => void }> = {
    facebook: { label: 'Facebook', manual: false, configured, connect: doFacebook },
    instagram: { label: 'Instagram', manual: false, configured: IG_APP_ID.length > 0, connect: doInstagram },
    threads: { label: 'Threads', manual: false, configured, connect: doThreads },
    tiktok: { label: 'TikTok', manual: false, configured: ttConfigured, connect: doTikTok },
    x: { label: 'X', manual: false, configured: xConfigured, connect: doX },
    bluesky: { label: 'Bluesky', manual: true, configured: true, connect: doBsky },
    mastodon: { label: 'Mastodon', manual: true, configured: true, connect: doMastodon },
    linkedin: { label: 'LinkedIn', manual: false, configured: liConfigured, connect: doLinkedin },
    youtube: { label: 'YouTube', manual: false, configured: ytConfigured, connect: doYoutube },
    pinterest: { label: 'Pinterest', manual: false, configured: pinConfigured, connect: doPinterest },
  };

  const accountLabel = (a: ConnectedAccount): string => {
    const n = accountName(a);
    if (n) return n;
    if (isCloudOnly(a)) return 'Via cloud';
    if (a.provider === 'facebook') return 'Choose a Page';
    if (a.provider === 'pinterest') return 'Connected — pick a board';
    return 'Connected';
  };

  const selectedAccountFor = (p: ProviderKey): ConnectedAccount | undefined => {
    const list = accounts.filter((a) => a.provider === p);
    const id = selId[p];
    return list.find((a) => a.id === id) ?? list[0];
  };

  const selectAccount = (p: ProviderKey, a: ConnectedAccount) => {
    setSelId((s) => ({ ...s, [p]: a.id }));
    if (isCloudOnly(a)) return; // no device tokens — pickers below can't load
    if (p === 'facebook') void loadPagesFor(a);
    else if (p === 'linkedin') void loadLiOrgsFor(a);
    else if (p === 'pinterest') void loadPinBoardsFor(a);
  };

  /** "Connect on this device" for a cloud-only placeholder. OAuth providers
   *  start the browser flow against the placeholder id (the return upgrades
   *  it in place); manual providers prefill the handle box and select the
   *  row so "Add this account" upgrades it instead of duplicating. */
  const connectCloudOnly = (p: ProviderKey, a: ConnectedAccount) => {
    selectAccount(p, a);
    if (providerCfg[p].manual) {
      if (p === 'bluesky' && typeof a.fields.bskyHandle === 'string' && a.fields.bskyHandle) {
        setBskyHandle(a.fields.bskyHandle.replace(/\.bsky\.social$/, ''));
      }
      if (p === 'mastodon' && typeof a.fields.mastodonInstance === 'string' && a.fields.mastodonInstance) {
        setMastodonInstance(a.fields.mastodonInstance);
      }
      return;
    }
    if (providerCfg[p].configured) providerCfg[p].connect(a.id);
  };

  const statusLabel = (p: ProviderKey, list: ConnectedAccount[]): string => {
    if (list.length === 0) {
      if (p === 'bluesky') return 'Handle + app password';
      if (p === 'mastodon') return 'Username + login';
      return 'Tap to connect';
    }
    if (list.length === 1) return accountLabel(list[0]);
    return `${list.length} accounts`;
  };

  const renderManualForm = (p: ProviderKey) => {
    const list = accounts.filter((a) => a.provider === p);
    // A selected cloud-only row upgrades in place instead of duplicating.
    const addId = () => {
      const sel = selectedAccountFor(p);
      if (sel && isCloudOnly(sel)) return sel.id;
      return list.length > 0 ? makeAccount(p).id : undefined;
    };
    if (p === 'bluesky') {
      return (
        <>
          <View style={s.bskyField}>
            <Txt
              value={bskyHandle}
              onChangeText={setBskyHandle}
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }}
            />
            {!bskyHandle.includes('.') ? <Text style={s.bskySuffix}>.bsky.social</Text> : null}
          </View>
          <Txt value={bskyPass} onChangeText={setBskyPass} placeholder="xxxx-xxxx-xxxx-xxxx" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to get your app password</Text>
            {[
              'Bluesky → Settings → Privacy and security → App passwords',
              'Press “+ Add App Password”',
              'Name it “Sosial”',
              'Tick “Allow access to your direct messages”',
              'Copy the one-time password and paste it above',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => void doBsky(addId())} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add this account' : 'Connect Bluesky'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (p === 'mastodon') {
      return (
        <>
          <View style={s.bskyField}>
            <Txt
              value={mastodonInstance}
              onChangeText={setMastodonInstance}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }}
            />
            {!mastodonInstance.includes('.') ? <Text style={s.bskySuffix}>@mastodon.social</Text> : null}
          </View>
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect Mastodon</Text>
            {[
              'Type your username — or a full server like fosstodon.org',
              'Sign in and approve the app on that server',
              'Posts and analytics then go to your account there',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => void doMastodon(addId())} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add this account' : 'Connect Mastodon'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    return null;
  };

  const renderSubPanel = (p: ProviderKey) => {
    const sel = selectedAccountFor(p);
    if (sel && isCloudOnly(sel)) {
      // Page/org/board pickers need device tokens — the placeholder only
      // offers the upgrade path (Connect on its row).
      return (
        <View style={s.pageRow}>
          <Text style={s.pageT} numberOfLines={2}>Synced from another device — press Connect on the account above to manage it here.</Text>
        </View>
      );
    }
    if (p === 'facebook') {
      const acct = selectedAccountFor('facebook');
      const pageId = acct?.fields.pageId as string | undefined;
      return (
        <>
          {pages.length > 0 ? (
            pages.map((pg) => {
              const on = pageId === pg.id;
              return (
                <TouchableOpacity
                  key={pg.id}
                  onPress={async () => { await pickPage(pg, acct?.id); setAccounts(await loadAccounts()); }}
                  style={[s.pageRow, on && { borderWidth: 1.5, borderColor: C.accent }]}
                  activeOpacity={0.75}
                >
                  <Text style={s.pageT} numberOfLines={1}>{pg.name}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={18} color={C.accent} /> : null}
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity onPress={() => acct && void loadPagesFor(acct)} activeOpacity={0.7} style={s.pageRow}>
              <Text style={s.pageT}>Load my Pages</Text>
            </TouchableOpacity>
          )}
        </>
      );
    }
    if (p === 'linkedin') {
      const acct = selectedAccountFor('linkedin');
      const orgId = acct?.fields.liOrgId as string | undefined;
      const liName = acct?.fields.liName as string | undefined;
      return (
        <>
          {liOrgs.length > 0 ? (
            <>
              <TouchableOpacity
                onPress={async () => { await pickLiOrg(null, acct?.id); setAccounts(await loadAccounts()); }}
                style={[s.pageRow, !orgId && { borderWidth: 1.5, borderColor: C.accent }]}
                activeOpacity={0.75}
              >
                <Text style={s.pageT} numberOfLines={1}>Post as {liName ?? 'myself'}</Text>
                {!orgId ? <Ionicons name="checkmark-circle" size={18} color={C.accent} /> : null}
              </TouchableOpacity>
              {liOrgs.map((o) => {
                const on = orgId === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={async () => { await pickLiOrg(o, acct?.id); setAccounts(await loadAccounts()); }}
                    style={[s.pageRow, on && { borderWidth: 1.5, borderColor: C.accent }]}
                    activeOpacity={0.75}
                  >
                    <Text style={s.pageT} numberOfLines={1}>{o.name}</Text>
                    {on ? <Ionicons name="checkmark-circle" size={18} color={C.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <TouchableOpacity onPress={() => acct && void loadLiOrgsFor(acct)} activeOpacity={0.7} style={s.pageRow}>
              <Text style={s.pageT}>Load my Company Pages</Text>
            </TouchableOpacity>
          )}
        </>
      );
    }
    if (p === 'pinterest') {
      const acct = selectedAccountFor('pinterest');
      const boardId = acct?.fields.pinBoardId as string | undefined;
      return (
        <>
          {pinBoardsLoading ? (
            <View style={s.pageRow}><Text style={s.pageT}>Loading boards…</Text></View>
          ) : pinBoards && pinBoards.length > 0 ? (
            pinBoards.map((b) => {
              const on = boardId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => { if (acct) void pickPinBoard(b, acct.id); }}
                  style={[s.pageRow, on && { borderWidth: 1.5, borderColor: C.accent }]}
                  activeOpacity={0.75}
                >
                  <Text style={s.pageT} numberOfLines={1}>{b.name}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={18} color={C.accent} /> : null}
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity onPress={() => acct && void loadPinBoardsFor(acct)} activeOpacity={0.7} style={s.pageRow}>
              <Text style={s.pageT}>Load my boards</Text>
            </TouchableOpacity>
          )}
        </>
      );
    }
    return null;
  };

  const orderedProviders = [...PROVIDERS].sort(
    (a, b) =>
      Number(accounts.some((x) => x.provider === b)) -
      Number(accounts.some((x) => x.provider === a)),
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.kicker}>Channels</Text>
        <Text style={[T.h1, { color: C.ink, marginTop: 8, fontSize: 30, lineHeight: 36 }]}>Connect</Text>

        <TouchableOpacity onPress={onTeam} style={s.teamBtn} activeOpacity={0.8}>
          <View style={s.teamIcon}>
            <Ionicons name="people-outline" size={19} color={C.onInk} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={s.teamT}>Team</Text>
            <Text style={s.teamS}>
              {teamCount === null
                ? 'Roles, channels & invites'
                : teamCount === 0
                  ? 'Invite teammates & manage roles'
                  : `${teamCount} teammate${teamCount === 1 ? '' : 's'} · roles & invites`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.faint} />
        </TouchableOpacity>

        {!configured ? (
          <View style={s.warn}>
            <Text style={s.warnT}>Add your Meta App ID in .env first, then reload.</Text>
          </View>
        ) : null}
        {!ttConfigured ? (
          <View style={s.warn}>
            <Text style={s.warnT}>Add your TikTok client key in .env first, then reload.</Text>
          </View>
        ) : null}
        {!xConfigured ? (
          <View style={s.warn}>
            <Text style={s.warnT}>Add your X Client ID in .env first, then reload.</Text>
          </View>
        ) : null}
        {!liConfigured ? (
          <View style={s.warn}>
            <Text style={s.warnT}>Add your LinkedIn Client ID + secret in .env first, then reload.</Text>
          </View>
        ) : null}
        {!ytConfigured ? (
          <View style={s.warn}>
            <Text style={s.warnT}>Add your Google Client ID + secret in .env first, then reload.</Text>
          </View>
        ) : null}
        {!pinConfigured ? (
          <View style={s.warn}>
            <Text style={s.warnT}>Add your Pinterest App ID + secret in .env first, then reload.</Text>
          </View>
        ) : null}

        <View style={s.list}>
          {orderedProviders.map((p) => {
            const cfg = providerCfg[p];
            const list = accounts.filter((a) => a.provider === p);
            const hasAny = list.length > 0;
            const expanded = openProvider === p;
            const connect = () => { if (cfg.configured) cfg.connect(undefined); };
            return (
              <View key={p}>
                <TouchableOpacity
                  onPress={() => {
                    if (!cfg.manual && !hasAny) connect();
                    else setOpenProvider(expanded ? null : p);
                  }}
                  style={[s.row, p !== orderedProviders[0] && s.rowDiv]}
                  activeOpacity={0.7}
                >
                  <ChannelIcon platform={p} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowT}>{cfg.label}</Text>
                    {list.length === 0 ? (
                      <Text style={s.rowS} numberOfLines={1}>{statusLabel(p, list)}</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <AccountStack platform={p} avatars={list.map((a) => accountAvatar(a))} size={14} max={2} ring={C.lineSoft} />
                        <Text style={s.rowS} numberOfLines={1}>
                          {list.slice(0, 2).map((a) => accountName(a) ?? accountLabel(a)).join(' · ')}
                          {list.length > 2 ? `  +${list.length - 2} more` : ''}
                          {list.length > 0 && list.every(isCloudOnly) ? ' · via cloud' : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                  {hasAny ? (
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
                  ) : (
                    <Text style={s.go}>Connect</Text>
                  )}
                </TouchableOpacity>

                {expanded ? (
                  <View style={s.sub}>
                    {cfg.manual ? renderManualForm(p) : null}
                    {list.map((a) => {
                      const isSel = selectedAccountFor(p)?.id === a.id;
                      const cloud = isCloudOnly(a);
                      return (
                        <View key={a.id} style={s.acctRow}>
                          <TouchableOpacity onPress={() => selectAccount(p, a)} activeOpacity={0.7} style={s.acctSel}>
                            <ChannelAvatar platform={p} avatar={accountAvatar(a)} size={30} badge={list.length > 1} />
                            <Text style={s.acctT} numberOfLines={1}>{accountLabel(a)}</Text>
                            {cloud ? (
                              <View style={s.cloudBadge}><Text style={s.cloudBadgeT}>Cloud</Text></View>
                            ) : null}
                            {!cloud && list.length > 1 && isSel ? <Ionicons name="checkmark-circle" size={16} color={C.accent} /> : null}
                          </TouchableOpacity>
                          {cloud ? (
                            <View style={s.cloudActions}>
                              <TouchableOpacity onPress={() => void connectCloudOnly(p, a)} activeOpacity={0.7}>
                                <Text style={s.go}>Connect</Text>
                              </TouchableOpacity>
                              {isOwner ? (
                                <TouchableOpacity onPress={() => void removeCloudAccount(a)} activeOpacity={0.7}>
                                  <Text style={s.discT}>Remove</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => void disconnectAccount(a)} activeOpacity={0.7}>
                              <Text style={s.discT}>Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                    {!cfg.manual ? renderSubPanel(p) : null}
                    {!cfg.manual && cfg.configured ? (
                      <TouchableOpacity onPress={() => cfg.connect(makeAccount(p).id)} activeOpacity={0.7} style={s.addRow}>
                        <Ionicons name="add-circle-outline" size={16} color={C.accentInk} />
                        <Text style={s.addRowT}>Add another {cfg.label} account</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={s.buildTag}>build {BUILD_TAG}</Text>
      </ScrollView>
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  teamBtn: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: C.card, borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 13, marginTop: 16 },
  teamIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  teamT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  teamS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 1 },
  kicker: { ...T.tag, color: C.accent, marginTop: 24 },
  warn: { backgroundColor: C.paleRed, borderRadius: R.lg, padding: 14, marginTop: 16 },
  warnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.redText, lineHeight: 19 },
  list: { backgroundColor: C.card, borderRadius: R.lg, overflow: 'hidden', marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 14 },
  rowDiv: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  rowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, letterSpacing: -0.2, color: C.ink },
  rowS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.muted, marginTop: 1 },
  go: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.accentInk },
  sub: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  acctSel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  acctT: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginTop: 2 },
  addRowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.accentInk },
  bskyField: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 13 },
  bskySuffix: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14.5, color: C.muted },
  helpCard: { backgroundColor: C.paper, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, padding: 12, gap: 8 },
  helpTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.ink },
  helpStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  helpNum: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.accentInk, backgroundColor: C.accentSoft, width: 18, height: 18, borderRadius: 9, textAlign: 'center', lineHeight: 18, overflow: 'hidden' },
  helpText: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: C.muted },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.paper, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 13, paddingVertical: 11 },
  pageT: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  discT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.redText },
  cloudActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cloudBadge: { backgroundColor: C.accentSoft, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  cloudBadgeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: C.accentInk },
  buildTag: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.faint, textAlign: 'center', marginTop: 14, marginBottom: 4 },
});
