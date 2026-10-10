import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, R, T } from '../theme';
import { SocialGlyph, Txt, ChannelAvatar, AccountStack } from '../components/ui';
import { Tabs } from '../components/ui-kit';
import { SOCIAL_META } from '../constants';
import { META_APP_ID, IG_APP_ID } from '../utils/metaConfig';
import { loadAccounts, removeAccount, saveProviderFields, makeAccount } from '../utils/metaStore';
import { canConnectProvider } from '../utils/plans';
import { accountName, accountAvatar, accountExpired, isCloudOnly, metaFromAccounts, type ConnectedAccount, type ProviderKey } from '../utils/socialAccounts';
import {
  loginFacebook, exchangeFacebookCode, fetchPages, pickPage, FbPage,
  loginInstagram, exchangeInstagramCode, fetchInstagramProfile,
  loginThreads, exchangeThreadsCode, fetchThreadsProfile,
} from '../utils/metaAuth';
import { loginTikTok, completeTikTokLogin, openTikTokSite } from '../utils/tiktokAuth';
import { loginX, completeXLogin } from '../utils/xAuth';
import { validateVk } from '../utils/vkAuth';
import { loginGmb, fetchGmbLocations, completeGmbLogin, type GmbLocation } from '../utils/gmbAuth';
import { X_CLIENT_ID } from '../utils/xConfig';
import { completeBskyLogin } from '../utils/bskyAuth';
import { validateTelegramBot, resolveTelegramChat } from '../utils/telegramAuth';
import { validateDiscordBot, listDiscordGuilds, listDiscordChannels, listDiscordThreads, type DiscordGuild, type DiscordChannel, type DiscordThread } from '../utils/discordAuth';
import { validateWordPress } from '../utils/wordpressAuth';
import { validateDevto } from '../utils/devtoAuth';
import { validateHashnode, type HashnodePublication } from '../utils/hashnodeAuth';
import { validateGhost } from '../utils/ghostAuth';
import { loginMastodon, completeMastodonLogin } from '../utils/mastodonAuth';
import { loginLinkedIn, completeLiLogin, listMyLiOrgs, pickLiOrg, LiOrg } from '../utils/liAuth';
import { LI_CLIENT_ID } from '../utils/liConfig';
import { loginYouTube, completeYtLogin } from '../utils/ytAuth';
import { YT_CLIENT_ID } from '../utils/ytConfig';
import { loginPinterest, completePinLogin } from '../utils/pinAuth';
import { PIN_CLIENT_ID } from '../utils/pinConfig';
import { listPinBoards, PinBoard } from '../utils/pinPublish';
import { loadCloudTeam } from '../utils/teamCloud';
import { disableCloudChannel, syncCloudChannels, pullCloudChannels, removeCloudChannelAccount } from '../utils/cloudChannels';
import { currentSession, callEdgeFunction } from '../utils/supabase';
import { subscribeAuthResult, flushAuthResults, clearPendingAuth, getPendingAuth, wasCodeDone, markCodeDone, AuthResult } from '../utils/authFlow';
import { backfillMissingAvatars } from '../utils/avatarBackfill';
import { TT_CLIENT_KEY } from '../utils/tiktokConfig';
import IntegrationsPanel from '../components/IntegrationsPanel';

const PROVIDERS: ProviderKey[] = ['facebook', 'instagram', 'threads', 'tiktok', 'x', 'bluesky', 'mastodon', 'linkedin', 'youtube', 'pinterest', 'telegram', 'discord', 'wordpress', 'devto', 'hashnode', 'ghost', 'vk'];

function ChannelIcon({ platform }: { platform: string }) {
  return <ChannelAvatar platform={platform} size={56} badge={false} />;
}

/** One compact row per provider — tap to connect, tap again to manage its accounts. */
export default function ConnectScreen({ onBack, onTeam, plan }: { onBack: () => void; onTeam: () => void; plan?: 'free' | 'pro' | 'team' }) {
  const { C } = useTheme();
  const s = makeS(C);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const meta = useMemo(() => metaFromAccounts(accounts), [accounts]);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  /** Channel writes are owner/admin-only (enforced by the token functions too). */
  const [isManager, setIsManager] = useState(false);
  /** Signed-in cloud users act on the shared workspace; signed-out users
   *  only ever touch device-local channels, so the gate doesn't apply. */
  const [cloudUser, setCloudUser] = useState(false);
  const [pages, setPages] = useState<FbPage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [openProvider, setOpenProvider] = useState<ProviderKey | null>(null);
  const [bskyHandle, setBskyHandle] = useState('');
  const [bskyPass, setBskyPass] = useState('');
  const [mastodonInstance, setMastodonInstance] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [dcToken, setDcToken] = useState('');
  const [dcGuilds, setDcGuilds] = useState<DiscordGuild[]>([]);
  const [dcGuild, setDcGuild] = useState('');
  const [dcChannels, setDcChannels] = useState<DiscordChannel[]>([]);
  const [dcThreads, setDcThreads] = useState<DiscordThread[]>([]);
  const [dcChannel, setDcChannel] = useState('');
  const [wpSite, setWpSite] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');
  const [devKey, setDevKey] = useState('');
  const [hnToken, setHnToken] = useState('');
  const [hnPubs, setHnPubs] = useState<HashnodePublication[]>([]);
  const [hnPub, setHnPub] = useState('');
  const [ghSite, setGhSite] = useState('');
  const [ghKey, setGhKey] = useState('');
  const [vkCommunity, setVkCommunity] = useState('');
  const [vkKey, setVkKey] = useState('');
  const [pinBoards, setPinBoards] = useState<PinBoard[] | null>(null);
  const [pinBoardsLoading, setPinBoardsLoading] = useState(false);
  const [liOrgs, setLiOrgs] = useState<LiOrg[]>([]);
  const [ggLocs, setGgLocs] = useState<GmbLocation[]>([]);
  const [ggOpen, setGgOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selId, setSelId] = useState<Partial<Record<ProviderKey, string>>>({});
  const [acctsLoading, setAcctsLoading] = useState(true);
  /** Channels publish; integrations feed the composer. Separate tabs. */
  const [tab, setTab] = useState<'channels' | 'integrations'>('channels');

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
      setAcctsLoading(false);
    })();
    loadCloudTeam()
      .then((t) => {
        setTeamCount(t ? Math.max(0, t.members.length - 1) : 0);
        setIsManager(t ? t.myRole === 'owner' || t.myRole === 'admin' : false);
      })
      .catch(() => setTeamCount(0));
    currentSession()
      .then((sn) => {
        setCloudUser(!!sn);
        setIsManager(sn ? sn.workspace.role === 'owner' || sn.workspace.role === 'admin' : false);
      })
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
      } else if (r.channel === 'gmb') {
        // Exchange first, then stage the location pick.
        const pid = r.accountId ?? 'acct_gmb';
        await completeGmbLogin(r.code, pid);
        const accts = await loadAccounts();
        setAccounts(accts);
        setSelId((s) => ({ ...s, gmb: pid }));
        try {
          const acct = accts.find((a) => a.id === pid);
          const tok = (acct?.fields.gmAccessToken as string | undefined) ?? '';
          if (tok) {
            setGgLocs(await fetchGmbLocations(tok));
            setGgOpen(true);
            setOpenProvider('gmb');
          } else {
            Alert.alert('Connected', 'Google connected — reconnect to pick a location.');
          }
        } catch (e: any) {
          Alert.alert('Connected', e?.message ?? 'Google connected — pick your location below.');
          setGgOpen(true);
          setOpenProvider('gmb');
        }
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
    // Paywalled provider: free plans can't start NEW X connects (reconnects
    // of existing accounts always work). Server enforces the same rule.
    if (!accountId && !canConnectProvider(plan ?? 'free', 'x')) {
      Alert.alert('X needs a paid plan', 'Its posting API is paywalled. Upgrade to connect X.');
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

  const doTelegram = async (accountId?: string) => {
    if (!tgToken.trim()) {
      Alert.alert('Bot token missing', 'Paste the token from @BotFather first.');
      return;
    }
    if (!tgChat.trim()) {
      Alert.alert('Destination missing', 'Enter the channel or group (id or @username).');
      return;
    }
    setBusy('Checking Telegram…');
    try {
      await validateTelegramBot(tgToken.trim());
      const chat = await resolveTelegramChat(tgToken.trim(), tgChat.trim());
      await saveProviderFields(
        'telegram',
        {
          tgBotToken: tgToken.trim(),
          tgChatId: chat.id,
          tgChatTitle: chat.title,
          ...(chat.avatar ? { avatar: chat.avatar } : {}),
        },
        accountId,
      );
      setTgToken('');
      setTgChat('');
      setAccounts(await loadAccounts());
      setOpenProvider('telegram');
      Alert.alert('Connected', `Telegram → ${chat.title}.`);
    } catch (e: any) {
      Alert.alert('Telegram connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const loadDcGuilds = async () => {
    if (!dcToken.trim()) {
      Alert.alert('Bot token missing', 'Paste the token from the Developer Portal first.');
      return;
    }
    setBusy('Asking Discord…');
    try {
      const guilds = await listDiscordGuilds(dcToken.trim());
      setDcGuilds(guilds);
      setDcGuild('');
      setDcChannels([]);
      setDcThreads([]);
      setDcChannel('');
      if (!guilds.length) Alert.alert('No servers', 'That bot is in no servers — invite it first.');
    } catch (e: any) {
      Alert.alert('Discord failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const loadDcChannels = async (guildId: string) => {
    setDcGuild(guildId);
    setDcChannels([]);
    setDcThreads([]);
    setDcChannel('');
    if (!guildId) return;
    setBusy('Loading channels…');
    try {
      const [channels, threads] = await Promise.all([
        listDiscordChannels(dcToken.trim(), guildId),
        listDiscordThreads(dcToken.trim(), guildId),
      ]);
      setDcChannels(channels);
      setDcThreads(threads);
      if (!channels.length && !threads.length) Alert.alert('No text channels', 'Check the bot can see one.');
    } catch (e: any) {
      Alert.alert('Discord failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doDiscord = async (accountId?: string) => {
    if (!dcChannel) {
      Alert.alert('Channel missing', 'Pick a server and channel first.');
      return;
    }
    setBusy('Connecting Discord…');
    try {
      const guild = dcGuilds.find((g) => g.id === dcGuild);
      const channel = dcChannels.find((c) => c.id === dcChannel);
      const thread = dcThreads.find((t) => t.id === dcChannel);
      const destName = thread
        ? `#${thread.parent_name || 'thread'} › ${thread.name}`
        : channel?.name ?? '';
      await saveProviderFields(
        'discord',
        {
          dcBotToken: dcToken.trim(),
          dcGuildId: dcGuild,
          dcGuildName: guild?.name ?? '',
          dcChannelId: dcChannel,
          dcChannelName: destName,
        },
        accountId,
      );
      setDcToken('');
      setDcGuilds([]);
      setDcGuild('');
      setDcChannels([]);
      setDcThreads([]);
      setDcChannel('');
      setAccounts(await loadAccounts());
      setOpenProvider('discord');
      Alert.alert('Connected', `Discord → ${destName || `#${dcChannel}`}.`);
    } catch (e: any) {
      Alert.alert('Discord connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doWordPress = async (accountId?: string) => {
    if (!wpSite.trim()) {
      Alert.alert('Site URL missing', 'Enter your site URL first (https://…).');
      return;
    }
    if (!wpUser.trim()) {
      Alert.alert('Username missing', 'Enter the WordPress username.');
      return;
    }
    if (!wpPass) {
      Alert.alert('Password missing', 'Paste the application password.');
      return;
    }
    setBusy('Checking the site…');
    try {
      const site = await validateWordPress(wpSite, wpUser, wpPass);
      await saveProviderFields(
        'wordpress',
        {
          wpSiteUrl: wpSite.trim().replace(/\/+$/, ''),
          wpUsername: wpUser.trim(),
          wpAppPassword: wpPass,
          wpSiteName: site.siteName,
          ...(site.avatar ? { avatar: site.avatar } : {}),
        },
        accountId,
      );
      setWpSite('');
      setWpUser('');
      setWpPass('');
      setAccounts(await loadAccounts());
      setOpenProvider('wordpress');
      Alert.alert('Connected', `WordPress → ${site.siteName}.`);
    } catch (e: any) {
      Alert.alert('WordPress connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doDevto = async (accountId?: string) => {
    if (!devKey.trim()) {
      Alert.alert('API key missing', 'Paste the key from dev.to → Settings → Extensions.');
      return;
    }
    setBusy('Checking Dev.to…');
    try {
      const id = await validateDevto(devKey.trim());
      await saveProviderFields(
        'devto',
        {
          devApiKey: devKey.trim(),
          devUserId: id.userId,
          devUsername: id.username,
          devName: id.name,
          ...(id.avatar ? { avatar: id.avatar } : {}),
        },
        accountId,
      );
      setDevKey('');
      setAccounts(await loadAccounts());
      setOpenProvider('devto');
      Alert.alert('Connected', `Dev.to → ${id.name || id.username}.`);
    } catch (e: any) {
      Alert.alert('Dev.to connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const loadHnPubs = async () => {
    if (!hnToken.trim()) {
      Alert.alert('Token missing', 'Paste the token from hashnode.com → Settings → Developer.');
      return;
    }
    setBusy('Asking Hashnode…');
    try {
      const id = await validateHashnode(hnToken.trim());
      setHnPubs(id.publications);
      setHnPub('');
      if (!id.publications.length) {
        Alert.alert('No publications', 'That token sees no publications — publish from an account with a blog.');
      }
    } catch (e: any) {
      Alert.alert('Hashnode failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doHashnode = async (accountId?: string) => {
    const pub = hnPubs.find((g) => g.id === hnPub);
    if (!pub) {
      Alert.alert('Publication missing', 'Pick a publication first.');
      return;
    }
    setBusy('Connecting Hashnode…');
    try {
      await saveProviderFields(
        'hashnode',
        {
          hnToken: hnToken.trim(),
          hnPublicationId: pub.id,
          hnPublicationTitle: pub.title,
        },
        accountId,
      );
      setHnToken('');
      setHnPubs([]);
      setHnPub('');
      setAccounts(await loadAccounts());
      setOpenProvider('hashnode');
      Alert.alert('Connected', `Hashnode → ${pub.title}.`);
    } catch (e: any) {
      Alert.alert('Hashnode connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doGhost = async (accountId?: string) => {
    if (!ghSite.trim()) {
      Alert.alert('Site URL missing', 'Enter your Ghost site URL first (https://…).');
      return;
    }
    if (!ghKey) {
      Alert.alert('Key missing', 'Paste the Admin API key (id:secret).');
      return;
    }
    setBusy('Checking the site…');
    try {
      const site = await validateGhost(ghKey, ghSite);
      await saveProviderFields(
        'ghost',
        {
          ghSiteUrl: site.siteUrl,
          ghAdminKey: ghKey.trim(),
          ghSiteName: site.siteName,
        },
        accountId,
      );
      setGhSite('');
      setGhKey('');
      setAccounts(await loadAccounts());
      setOpenProvider('ghost');
      Alert.alert('Connected', `Ghost → ${site.siteName}.`);
    } catch (e: any) {
      Alert.alert('Ghost connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doGmb = async (accountId?: string) => {
    setBusy('Opening Google…');
    if (!(await loginGmb(accountId))) backedOut('Google Business');
  };

  /** Stage 2 of the GBP connect: clone account-level tokens into a
   *  per-location row (multi-account clone via saveProviderFields). */
  const doGmbPick = async (loc: GmbLocation, accountId?: string) => {
    setBusy(`Connecting ${loc.title}…`);
    try {
      const accounts = await loadAccounts();
      const src =
        (accountId ? accounts.find((a) => a.id === accountId) : undefined) ??
        accounts.find((a) => a.provider === 'gmb' && !!a.fields.gmLocation) ??
        accounts.find((a) => a.provider === 'gmb' && a.fields.gmRefreshToken);
      const f = src?.fields ?? {};
      if (!f.gmRefreshToken) {
        throw new Error('Google login is missing — connect Google Business first.');
      }
      await saveProviderFields(
        'gmb',
        {
          gmAccessToken: f.gmAccessToken,
          gmRefreshToken: f.gmRefreshToken,
          gmExpiresAt: f.gmExpiresAt,
          gmLocation: loc.name,
          gmLocationTitle: loc.title,
        },
        accountId,
      );
      setAccounts(await loadAccounts());
      Alert.alert('Connected', `Google Business → ${loc.title}.`);
    } catch (e: any) {
      Alert.alert('Google Business connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doVk = async (accountId?: string) => {    if (!vkCommunity.trim()) {
      Alert.alert('Community missing', 'Enter the community link, short name or numeric id first.');
      return;
    }
    if (!vkKey) {
      Alert.alert('Key missing', 'Paste the community access key.');
      return;
    }
    setBusy('Asking VK…');
    try {
      const community = await validateVk(vkKey, vkCommunity);
      await saveProviderFields(
        'vk',
        {
          vkToken: vkKey.trim(),
          vkGroupId: community.groupId,
          vkGroupName: community.groupName,
          vkScreenName: community.screenName,
        },
        accountId,
      );
      setVkCommunity('');
      setVkKey('');
      setAccounts(await loadAccounts());
      setOpenProvider('vk');
      Alert.alert('Connected', `VK → ${community.groupName}.`);
    } catch (e: any) {
      Alert.alert('VK connect failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
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

  const providerCfg: Record<ProviderKey, { label: string; manual: boolean; configured: boolean; soon?: boolean; connect: (accountId?: string) => void }> = {
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
    telegram: { label: 'Telegram', manual: true, configured: true, connect: doTelegram },
    discord: { label: 'Discord', manual: true, configured: true, connect: doDiscord },
    wordpress: { label: 'WordPress', manual: true, configured: true, connect: doWordPress },
    devto: { label: 'Dev.to', manual: true, configured: true, connect: doDevto },
    hashnode: { label: 'Hashnode', manual: true, configured: true, connect: doHashnode },
    ghost: { label: 'Ghost', manual: true, configured: true, connect: doGhost },
    vk: { label: 'VK', manual: true, configured: true, connect: doVk },
    gmb: { label: 'Google Business', manual: false, configured: true, soon: true, connect: doGmb },
  };

  const accountLabel = (a: ConnectedAccount): string => {
    const n = accountName(a);
    if (n) return n;
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

  /** Managers-only gate for every connect/remove tap (the token functions
   *  enforce the same rule server-side — this just explains it first).
   *  Signed-out users only touch device-local channels: always allowed. */
  const needManager = (): boolean => {
    if (!cloudUser || isManager) return true;
    Alert.alert('Owners and admins only', 'Only owners and admins can connect or remove channels.');
    return false;
  };
  /** "Connect on this device" for a cloud-only placeholder (upgrades in place). */
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
      if (p === 'telegram') return 'Bot token + chat';
      if (p === 'discord') return 'Bot token + server';
      if (p === 'wordpress') return 'Site + app password';
      if (p === 'devto') return 'API key';
      if (p === 'hashnode') return 'Token + publication';
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
          <TouchableOpacity onPress={() => { if (needManager()) void doBsky(addId()); }} activeOpacity={0.7} style={s.pageRow}>
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
          <TouchableOpacity onPress={() => { if (needManager()) void doMastodon(addId()); }} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add this account' : 'Connect Mastodon'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (p === 'telegram') {
      return (
        <>
          <Txt value={tgToken} onChangeText={setTgToken} placeholder="Bot token (123456:ABC…)" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Txt value={tgChat} onChangeText={setTgChat} placeholder="Destination: @channel or -100…" autoCapitalize="none" autoCorrect={false} />
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect Telegram</Text>
            {[
              'Message @BotFather for a bot token',
              'Add the bot to your channel/group as an admin',
              'Paste the destination id or @username above',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => { if (needManager()) void doTelegram(addId()); }} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add another bot' : 'Connect Telegram'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (p === 'discord') {
      return (
        <>
          <Txt value={dcToken} onChangeText={(v) => { setDcToken(v); setDcGuilds([]); setDcGuild(''); setDcChannels([]); setDcThreads([]); setDcChannel(''); }} placeholder="Bot token" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect Discord</Text>
            {[
              'Developer Portal → new app → Bot → copy token',
              'Invite it: Guild Install + Send Messages + Read Message History',
              'Paste token below → list servers → pick a channel or thread',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => Linking.openURL('https://discord.com/developers/home')} activeOpacity={0.7}>
              <Text style={[s.helpText, { color: C.accentInk, fontWeight: '700' }]}>Open Discord Developer Portal ›</Text>
            </TouchableOpacity>
          </View>
          {dcGuilds.length === 0 ? (
            <TouchableOpacity onPress={() => { if (needManager()) void loadDcGuilds(); }} activeOpacity={0.7} style={s.pageRow}>
              <Text style={s.pageT}>List my servers</Text>
            </TouchableOpacity>
          ) : (
            <>
              {dcGuilds.map((g) => (
                <TouchableOpacity key={g.id} onPress={() => void loadDcChannels(g.id)} activeOpacity={0.7} style={s.pageRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {dcGuild === g.id ? <Ionicons name="checkmark-circle" size={15} color={C.accent} /> : null}
                    <Text style={s.pageT}>{g.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {dcChannels.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => setDcChannel(c.id)} activeOpacity={0.7} style={s.pageRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {dcChannel === c.id ? <Ionicons name="checkmark-circle" size={15} color={C.accent} /> : null}
                    <Text style={s.pageT}>#{c.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {dcThreads.length > 0 ? (
                <Text style={[s.pageT, { marginTop: 8, color: C.muted }]}>Threads</Text>
              ) : null}
              {dcThreads.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => setDcChannel(t.id)} activeOpacity={0.7} style={s.pageRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {dcChannel === t.id ? <Ionicons name="checkmark-circle" size={15} color={C.accent} /> : null}
                    <Text style={s.pageT}>#{t.parent_name || 'thread'} › {t.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { if (needManager()) void doDiscord(addId()); }} activeOpacity={0.7} style={s.pageRow}>
                <Text style={s.pageT}>{list.length > 0 ? 'Add this channel' : 'Connect Discord'}</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      );
    }
    if (p === 'wordpress') {
      return (
        <>
          <Txt value={wpSite} onChangeText={setWpSite} placeholder="https://example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Txt value={wpUser} onChangeText={setWpUser} placeholder="Username" autoCapitalize="none" autoCorrect={false} />
          <Txt value={wpPass} onChangeText={setWpPass} placeholder="xxxx xxxx xxxx xxxx" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect WordPress</Text>
            {[
              'On your site: Users → Profile → Application Passwords',
              'Name it “Sosial”, copy the generated password',
              'Each site connects separately — no central approval',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => { if (needManager()) void doWordPress(addId()); }} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add another site' : 'Connect WordPress'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (p === 'devto') {
      return (
        <>
          <Txt value={devKey} onChangeText={setDevKey} placeholder="API key" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect Dev.to</Text>
            {[
              'dev.to → Settings → Extensions → generate a key',
              'Paste it above — articles publish under your account',
              'Tags cap at 4, covers come later',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => { if (needManager()) void doDevto(addId()); }} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add another account' : 'Connect Dev.to'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (p === 'hashnode') {
      return (
        <>
          <Txt value={hnToken} onChangeText={(v) => { setHnToken(v); setHnPubs([]); setHnPub(''); }} placeholder="Personal access token" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={[s.helpCard, { borderColor: C.accent, borderWidth: 1 }]}>
            <Text style={[s.helpTitle, { color: C.accentInk }]}>Hashnode Pro required</Text>
            <Text style={s.helpText}>Only Pro publications can connect — upgrade at your blog dashboard → Billing first.</Text>
          </View>
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect Hashnode</Text>
            {[
              'hashnode.com → Settings → Developer → new token',
              'List publications, pick the blog below',
              'Articles publish there as you',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          {hnPubs.length === 0 ? (
            <TouchableOpacity onPress={() => { if (needManager()) void loadHnPubs(); }} activeOpacity={0.7} style={s.pageRow}>
              <Text style={s.pageT}>List my publications</Text>
            </TouchableOpacity>
          ) : (
            <>
              {hnPubs.map((g) => (
                <TouchableOpacity key={g.id} onPress={() => setHnPub(g.id)} activeOpacity={0.7} style={s.pageRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {hnPub === g.id ? <Ionicons name="checkmark-circle" size={15} color={C.accent} /> : null}
                    <Text style={s.pageT}>{g.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { if (needManager()) void doHashnode(addId()); }} activeOpacity={0.7} style={s.pageRow}>
                <Text style={s.pageT}>{list.length > 0 ? 'Add this publication' : 'Connect Hashnode'}</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      );
    }
    if (p === 'ghost') {
      return (
        <>
          <Txt value={ghSite} onChangeText={setGhSite} placeholder="https://example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Txt value={ghKey} onChangeText={setGhKey} placeholder="Admin API key (id:secret)" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect Ghost</Text>
            {[
              'Ghost Admin → Settings → Integrations → Add custom',
              'Copy the Admin API Key (not the content key)',
              'Each site connects separately — no central approval',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => { if (needManager()) void doGhost(addId()); }} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add another site' : 'Connect Ghost'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (p === 'vk') {
      return (
        <>
          <Txt value={vkCommunity} onChangeText={setVkCommunity} placeholder="vk.com/club123, short name or id" autoCapitalize="none" autoCorrect={false} />
          <Txt value={vkKey} onChangeText={setVkKey} placeholder="Community access key" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect VK</Text>
            {[
              'Community → Manage → Working with API → Access Tokens',
              'Create a key with wall + photos rights (never expires)',
              'Communities only — personal-profile posting is VK-gated',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => { if (needManager()) void doVk(addId()); }} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add another community' : 'Connect VK'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (p === 'gmb') {
      return (
        <>
          <View style={s.helpCard}>
            <Text style={s.helpTitle}>How to connect Google Business</Text>
            {[
              'Sign in with the Google account that manages the profile',
              'Pick your location below (each connects separately)',
              'Posts publish as local posts on the profile',
            ].map((step, i) => (
              <View key={i} style={s.helpStep}>
                <Text style={s.helpNum}>{i + 1}</Text>
                <Text style={s.helpText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => { if (needManager()) void doGmb(addId()); }} activeOpacity={0.7} style={s.pageRow}>
            <Text style={s.pageT}>{list.length > 0 ? 'Add another location' : 'Connect Google Business'}</Text>
          </TouchableOpacity>
        </>
      );
    }
    return null;
  };

  const renderSubPanel = (p: ProviderKey) => {
    const sel = selectedAccountFor(p);
    if (sel && isCloudOnly(sel)) {
      // Page/org/board pickers need this phone connected — the placeholder
      // only offers the upgrade path (Connect on its row).
      return (
        <View style={s.pageRow}>
          <Text style={s.pageT} numberOfLines={2}>To manage it on this phone, press Connect on the account above.</Text>
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
    if (p === 'gmb') {
      const sel = selectedAccountFor('gmb');
      const cur = sel?.fields.gmLocation as string | undefined;
      return (
        <>
          {ggOpen && ggLocs.length > 0 ? (
            ggLocs.map((l) => (
              <TouchableOpacity
                key={l.name}
                onPress={() => { if (needManager()) void doGmbPick(l, sel?.id); }}
                style={[s.pageRow, cur === l.name && { borderWidth: 1.5, borderColor: C.accent }]}
                activeOpacity={0.75}
              >
                <Text style={s.pageT} numberOfLines={1}>{l.title}</Text>
                {cur === l.name ? <Ionicons name="checkmark-circle" size={18} color={C.accent} /> : null}
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              onPress={async () => {
                const acct = sel ?? selectedAccountFor('gmb');
                const tok = (acct?.fields.gmAccessToken as string | undefined) ?? '';
                if (!tok) {
                  Alert.alert('Connect first', 'Sign in with Google above, then pick your location here.');
                  return;
                }
                setBusy('Loading locations…');
                try {
                  setGgLocs(await fetchGmbLocations(tok));
                  setGgOpen(true);
                } catch (e: any) {
                  Alert.alert('Could not list locations', e?.message ?? 'Try again.');
                } finally {
                  setBusy(null);
                }
              }}
              activeOpacity={0.7}
              style={s.pageRow}
            >
              <Text style={s.pageT}>List my locations</Text>
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

  /** On-demand health check: worker revalidates every token (expired ones
   *  surface here), avatars refresh, then we reload. Same backend as web Sync. */
  const syncHealth = async () => {
    if (!needManager()) return;
    setSyncing(true);
    try {
      const sn = await currentSession().catch(() => null);
      if (!sn) {
        Alert.alert('Sign in', 'Sign in to Sosial Cloud first (Account tab).');
        return;
      }
      const j: any = await callEdgeFunction('recheck-channels', { workspace_id: sn.workspace.id });
      await syncCloudChannels().catch(() => null);
      setAccounts(await loadAccounts().catch(() => []));
      Alert.alert(
        'Health check started',
        `Re-checking ${j?.queued_refresh ?? 'your'} channel(s) — expired tokens will show up here shortly.`,
      );
    } catch (e: any) {
      Alert.alert('Sync failed', e?.message ?? 'Could not start the health check.');
    } finally {
      setSyncing(false);
    }
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
        <Text style={s.kicker}>{tab === 'channels' ? 'Channels' : 'Integrations'}</Text>
        <Text style={[T.h1, { color: C.ink, marginTop: 8, fontSize: 30, lineHeight: 36 }]}>Connect</Text>

        <View style={{ marginTop: 16, alignSelf: 'flex-start' }}>
          <Tabs
            options={[
              { value: 'channels', label: 'Channels' },
              { value: 'integrations', label: 'Integrations' },
            ]}
            value={tab}
            onChange={setTab}
            accessibilityLabel="Connect sections"
          />
        </View>

        {!isManager && cloudUser ? (
          <View style={[s.warn, { marginTop: 12 }]}>
            <Text style={s.warnT}>You can see the workspace channels here, but only owners and admins can connect or remove them.</Text>
          </View>
        ) : null}

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

        {tab === 'channels' ? (
        <>
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
          {cloudUser ? (
            <TouchableOpacity
              onPress={() => void syncHealth()}
              disabled={syncing}
              activeOpacity={0.7}
              style={[s.syncBtn, syncing && { opacity: 0.6 }]}
            >
              <Ionicons name="sync" size={15} color={C.accentInk} />
              <Text style={s.syncBtnT}>{syncing ? 'Checking…' : 'Check channel health'}</Text>
            </TouchableOpacity>
          ) : null}
          {acctsLoading ? (
            [...Array(6)].map((_, i) => (
              <View key={i} style={[s.row, i !== 0 && s.rowDiv]}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.lineSoft }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ width: '38%', height: 13, borderRadius: 6, backgroundColor: C.lineSoft }} />
                  <View style={{ width: '68%', height: 11, borderRadius: 6, backgroundColor: C.lineSoft }} />
                </View>
              </View>
            ))
          ) : orderedProviders.map((p) => {
            const cfg = providerCfg[p];
            const list = accounts.filter((a) => a.provider === p);
            const hasAny = list.length > 0;
            const expiredHere = list.map((a) => accountExpired(a)).filter(Boolean) as string[];
            const expanded = openProvider === p;
            const connect = () => { if (!needManager()) return; if (cfg.configured) cfg.connect(undefined); };
            const soonTap = () => {
              Alert.alert(
                `${cfg.label} is coming soon`,
                'Google still has to approve the API access. It will light up here the moment it does.',
              );
            };
            return (
              <View key={p}>
                <TouchableOpacity
                  onPress={() => {
                    if (cfg.soon) { soonTap(); return; }
                    if (!cfg.manual && !hasAny) connect();
                    else setOpenProvider(expanded ? null : p);
                  }}
                  style={[s.row, p !== orderedProviders[0] && s.rowDiv]}
                  activeOpacity={0.7}
                >
                  <ChannelIcon platform={p} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.rowT}>{cfg.label}</Text>
                      {cfg.soon ? (
                        <View style={s.soonBadge}><Text style={s.soonBadgeT}>Soon</Text></View>
                      ) : null}
                      {expiredHere.length > 0 ? (
                        <View style={s.reconnectBadge}>
                          <Ionicons name="warning" size={10} color="#8a6100" />
                          <Text style={s.reconnectBadgeT}>Reconnect</Text>
                        </View>
                      ) : null}
                    </View>
                    {list.length === 0 ? (
                      <Text style={s.rowS} numberOfLines={1}>{statusLabel(p, list)}</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <AccountStack platform={p} avatars={list.map((a) => accountAvatar(a))} size={14} max={2} ring={C.lineSoft} />
                        <Text style={s.rowS} numberOfLines={1}>
                          {list.slice(0, 2).map((a) => accountName(a) ?? accountLabel(a)).join(' · ')}
                          {list.length > 2 ? `  +${list.length - 2} more` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                  {hasAny ? (
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
                  ) : p === 'x' && !canConnectProvider(plan ?? 'free', 'x') ? (
                    <View style={s.soonBadge}><Text style={s.soonBadgeT}>Pro</Text></View>
                  ) : (
                    <Text style={s.go}>Connect</Text>
                  )}
                </TouchableOpacity>

                {expanded ? (
                  <View style={s.sub}>
                    {list.map((a) => {
                      const isSel = selectedAccountFor(p)?.id === a.id;
                      const cloud = isCloudOnly(a);
                      const deadReason = accountExpired(a);
                      return (
                        <View key={a.id} style={s.acctRow}>
                          <TouchableOpacity onPress={() => selectAccount(p, a)} activeOpacity={0.7} style={s.acctSel}>
                            <ChannelAvatar platform={p} avatar={accountAvatar(a)} size={30} badge={list.length > 1} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.acctT} numberOfLines={1}>{accountLabel(a)}</Text>
                              {deadReason ? (
                                <Text style={s.acctErr} numberOfLines={2}>{deadReason}</Text>
                              ) : null}
                            </View>
                            {deadReason ? (
                              <Ionicons name="warning" size={16} color="#e6a417" />
                            ) : !cloud && list.length > 1 && isSel ? (
                              <Ionicons name="checkmark-circle" size={16} color={C.accent} />
                            ) : null}
                          </TouchableOpacity>
                          {cloud ? (
                            <View style={s.cloudActions}>
                              <TouchableOpacity onPress={() => { if (needManager()) void connectCloudOnly(p, a); }} activeOpacity={0.7}>
                                <Text style={s.go}>Connect</Text>
                              </TouchableOpacity>
                              {!cloudUser || isManager ? (
                                <TouchableOpacity onPress={() => void removeCloudAccount(a)} activeOpacity={0.7} style={s.discBtn}>
                                  <Text style={s.discT}>Remove</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : (
                            !cloudUser || isManager ? (
                            <TouchableOpacity onPress={() => void disconnectAccount(a)} activeOpacity={0.7} style={s.discBtn}>
                              <Text style={s.discT}>Remove</Text>
                            </TouchableOpacity>
                            ) : null
                          )}
                        </View>
                      );
                    })}
                    {cfg.manual && !cfg.soon ? renderManualForm(p) : null}
                    {!cfg.manual && !cfg.soon ? renderSubPanel(p) : null}
                    {cfg.soon ? (
                      <View style={s.pageRow}>
                        <Text style={s.pageT} numberOfLines={3}>Coming soon — Google still has to approve the API access. It will light up here the moment it does.</Text>
                      </View>
                    ) : null}
                    {p === 'tiktok' && list.length > 0 ? (
                      <View style={s.switchBox}>
                        <Text style={s.switchT}>
                          TikTok signs in with whoever is logged in — to add a different account, switch it on tiktok.com first, then add below.
                        </Text>
                        <TouchableOpacity onPress={() => void openTikTokSite()} activeOpacity={0.7} style={s.switchBtn}>
                          <Ionicons name="open-outline" size={14} color={C.accentInk} />
                          <Text style={s.switchBtnT}>Open tiktok.com to switch accounts</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {!cfg.manual && cfg.configured && !cfg.soon ? (
                      <TouchableOpacity onPress={() => { if (needManager()) cfg.connect(makeAccount(p).id); }} activeOpacity={0.7} style={s.addRow}>
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
        </>
        ) : (
          <View style={{ marginTop: 16 }}>
            <IntegrationsPanel />
          </View>
        )}
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
  acctT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  acctErr: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 15, color: '#8a6100', marginTop: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginTop: 2 },
  addRowT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.accentInk },
  switchBox: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.lineSoft, padding: 12, marginTop: 8, gap: 8 },
  switchT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: C.muted },
  switchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
           paddingVertical: 8, borderRadius: 10, backgroundColor: C.accentSoft },
  switchBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.accentInk },
  soonBadge: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  soonBadgeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.accentInk },
  reconnectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FDF3D7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  reconnectBadgeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#8a6100' },
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
  discBtn: { borderWidth: 1, borderColor: C.lineSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.lineSoft, borderRadius: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: C.paper },
  syncBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.accentInk },
  cloudActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
