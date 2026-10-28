import React, { useState } from 'react';
import { StatusBar, ActivityIndicator, View, Text, BackHandler, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { isRunningInExpoGo } from 'expo';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PostProvider, usePost } from './src/store/PostContext';
import { ComposerProvider, useComposer } from './src/store/ComposerContext';
import { loadProjects } from './src/screens/HomeScreen';
import CreateScreen from './src/screens/CreateScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import WelcomeScreen, { WelcomeProfile } from './src/screens/WelcomeScreen';
import LandingScreen from './src/screens/LandingScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import AccountScreen from './src/screens/AccountScreen';
import SizeScreen from './src/screens/SizeScreen';
import EditorScreen from './src/screens/EditorScreen';
import ExportScreen from './src/screens/ExportScreen';
import ConnectScreen from './src/screens/ConnectScreen';
import TeamScreen from './src/screens/TeamScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import BottomNav, { type MainTab } from './src/components/BottomNav';
import Grain from './src/components/Grain';
import Tour from './src/components/Tour';
import { useFontsLoaded } from './src/utils/fonts';
import { loadAccount, saveAccount, Account } from './src/utils/account';
import { setLocale } from './src/i18n';
import { loadEntitlement, refreshEntitlement, type Entitlement } from './src/utils/entitlement';
import { internalKeyFor } from './src/utils/plans';
import { pushProfileToCloud, currentSession, isSupabaseConfigured, listMyWorkspaces } from './src/utils/supabase';
import { handleAuthUrl, getPendingAuth } from './src/utils/authFlow';
import { backfillMissingAvatars } from './src/utils/avatarBackfill';
import { pullCloudChannels, prefetchWorkspaceChannels } from './src/utils/cloudChannels';
import { pullCloudPosts } from './src/utils/cloudPosts';
import { useTheme, ThemeProvider } from './src/theme';

type Route = 'home' | 'create' | 'analytics' | 'community' | 'size' | 'editor' | 'export' | 'connect' | 'privacy' | 'account' | 'team';

// Canvas is a fixed-size export artifact — ignore the OS font-size setting
// so it renders pixel-identical on every device (esp. Android). Also kill
// Android's extra font padding, which shifts every line box vs iOS.
(Text as any).defaultProps = { ...((Text as any).defaultProps ?? {}), allowFontScaling: false, includeFontPadding: false };
// First-run gate: fresh installs land on the landing screen unless a cloud
// session already exists. Sign-in is required, there is no guest mode.
const WELCOME_SEEN_KEY = 'zap_welcome_seen_v1';
const LOCAL_OK_KEY = 'zap_local_ok_v1';

function Shell() {
  const { C, mode } = useTheme();
  const { openPostById, publishPostById } = useComposer();
  const [route, setRoute] = useState<Route>('home');
  const [connectFrom, setConnectFrom] = useState<Route>('create');
  const [privacyFrom, setPrivacyFrom] = useState<Route>('account');
  const [teamFrom, setTeamFrom] = useState<Route>('create');
  /** Bumped after a team switch to remount the screens against the new workspace. */
  const [wsEpoch, setWsEpoch] = useState(0);
  /** Bumped when returning from Connect so the tab screens re-read channels. */
  const [tabEpoch, setTabEpoch] = useState(0);
  const [postSignal, setPostSignal] = useState(0);
  const [account, setAccount] = useState<Account>({ email: '', team: 'My team', plan: 'free', notifPosts: true, notifComments: true, notifWeekly: false, notifMarketing: false, locale: 'en' });
  /** Keep the on-device translator in step with the saved language. */
  // Set during render so this render's screens already read the new language.
  setLocale(account.locale);
  /** Server-authoritative plan + limits for the active workspace (null until
   *  the first fetch; the UI falls back to the local plan while offline). */
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const { loadPost, clearPost, setPageIndex } = usePost();
  const fontsLoaded = useFontsLoaded();
  const routeRef = React.useRef(route);
  routeRef.current = route;
  /** p109: the workspace this session was resolved against, so a team switch
   *  made on the web is noticed on foreground instead of at the next launch. */
  const wsIdRef = React.useRef<string | null>(null);
  /** Tabs mount once and stay mounted (hidden when inactive): switching tabs
   *  no longer refetches the whole screen, and scroll/form state survives. */
  const [insightsFrom, setInsightsFrom] = useState<Route>('home');
  const [seenTabs, setSeenTabs] = useState<Set<Route>>(() => new Set<Route>(['home']));
  React.useEffect(() => {
    const tab = route === 'home' || route === 'create' || route === 'analytics' || route === 'community' || route === 'account';
    if (!tab) return;
    setSeenTabs((prev) => (prev.has(route) ? prev : new Set(prev).add(route)));
  }, [route]);

  React.useEffect(() => {
    if (route !== 'home' && route !== 'create') return;
    // Opening Home/Post re-checks the cloud (single-flight + throttled): a
    // post published, failed or edited on the web lands without a restart.
    void import('./src/utils/cloudPosts')
      .then((m) => m.requestCloudPostSync(20000))
      .catch(() => null);
  }, [route]);

  React.useEffect(() => {
    loadAccount().then(setAccount);
    // Server truth for the plan/limits (cached immediately, refreshed in the
    // background). Cloud wins; the local plan is only an offline fallback.
    void loadEntitlement().then(setEntitlement);
    void refreshEntitlement().then((e) => { if (e) setEntitlement(e); });
    // One-shot picture backfill for pre-avatar accounts (throttled daily,
    // silent) - pushes fresh pictures to the cloud for the web marks.
    backfillMissingAvatars().catch(() => {});
    // Cloud → device channel pull on open + foreground (throttled inside):
    // web-side connects/disconnects show up here without visiting Connect.
    void pullCloudChannels().catch(() => {});
    // Prefetch the OTHER teams' channel placeholders so the first switch to a
    // team renders its chips instantly instead of waiting on the switch pull.
    void (async () => {
      const sn = await currentSession().catch(() => null);
      if (!sn) return;
      const all = await listMyWorkspaces(sn.user.id).catch(() => []);
      for (const w of all) {
        if (w.id !== sn.workspace.id) await prefetchWorkspaceChannels(w.id);
      }
    })();
    // Ideas/templates sync. Post sync (pull + push + verdicts) is owned by
    // ComposerProvider's single sweep, never run twice: two concurrent pulls
    // re-downloaded the same media and doubled launch work.
    void (async () => {
      const [{ syncIdeas }, { syncTemplates }] = await Promise.all([
        import('./src/utils/ideas'),
        import('./src/utils/presets'),
      ]);
      await syncIdeas().catch(() => null);
      await syncTemplates().catch(() => null);
    })();
    const subState = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void pullCloudChannels().catch(() => {});
        // p109: the team can be switched from the web, and myWorkspace() now
        // follows the account column. When that moved, remount the screens
        // against the new team instead of showing the old one until relaunch.
        void (async () => {
          const sn = await currentSession().catch(() => null);
          if (!sn || wsIdRef.current === sn.workspace.id) return;
          wsIdRef.current = sn.workspace.id;
          setAccount(await saveAccount({ team: sn.workspace.name }));
          setWsEpoch((n) => n + 1);
          void refreshEntitlement().then((e) => { if (e) setEntitlement(e); });
          void pullCloudChannels(true).catch(() => {});
          void pullCloudPosts().catch(() => {});
        })();
        void (async () => {
          const [{ syncIdeas }, { syncTemplates }] = await Promise.all([
            import('./src/utils/ideas'),
            import('./src/utils/presets'),
          ]);
          await syncIdeas().catch(() => null);
          await syncTemplates().catch(() => null);
        })();
      }
    });
    return () => subState.remove();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        if (!isSupabaseConfigured()) {
          setShowLanding(true);
          return;
        }
        const s = await currentSession().catch(() => null);
        if (s) {
          wsIdRef.current = s.workspace.id;
          return;
        }
        // No session: fresh installs land, and the signed-out land back here too.
        setShowLanding(true);
      } catch {
      } finally {
        setWelcomeReady(true);
      }
    })();
  }, []);

  // OAuth return: Expo Go reloads the project on the exp:// redirect, so the
  // pending channel is replayed here and the Connect screen finishes the login.
  React.useEffect(() => {
    let sub: { remove: () => void } | null = null;
    const consume = async (url: string | null) => {
      if (!url) return;
      const r = await handleAuthUrl(url);
      if (r) setRoute('connect');
    };
    (async () => {
      try {
        if (await getPendingAuth()) setRoute('connect');
        await consume(await Linking.getInitialURL());
      } catch {}
    })();
    sub = Linking.addEventListener('url', ({ url }) => {
      void consume(url);
    });
    return () => sub?.remove();
  }, []);

  const patchAccount = async (patch: Partial<Account>) => {
    setAccount(await saveAccount(patch));
    // Cloud mirror is best-effort: local save already succeeded above.
    void pushProfileToCloud(patch);
  };

  /** Team switched on the Team screen: the new workspace is already pinned in
   *  SecureStore, so reload entitlement and channels and remount every screen
   *  against it (keyed on wsEpoch below). */
  const onTeamSwitched = async (ws: { id: string; name: string }) => {
    wsIdRef.current = ws.id;
    setAccount(await saveAccount({ team: ws.name }));
    setWsEpoch((n) => n + 1);
    setRoute('home');
    void refreshEntitlement().then((e) => { if (e) setEntitlement(e); });
    // Force both pulls: the new workspace may have channels and posts this
    // device has never seen, and the 5-minute throttles must not hide them.
    console.log('[cloud] switch team →', ws.name, ws.id.slice(0, 8));
    void pullCloudChannels(true).catch(() => {});
    void pullCloudPosts().catch(() => {});
  };

  const dismissWelcome = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {}
    setShowWelcome(false);
  };

  // Welcome sign-in: cloud wins, same as AccountScreen's post-login sync.
  const enterFromWelcome = async (profile: WelcomeProfile) => {
    await patchAccount({
      email: profile.email,
      team: profile.team,
      notifPosts: profile.notifPosts,
      notifComments: profile.notifComments,
      notifWeekly: profile.notifWeekly,
      notifMarketing: profile.notifMarketing,
      locale: profile.locale,
    });
    await dismissWelcome();
    try { await AsyncStorage.removeItem(LOCAL_OK_KEY); } catch {}
    setRoute('home');
    void refreshEntitlement().then((e) => { if (e) setEntitlement(e); });
  };

  // Any sign-out lands back on landing (auth behind it, no skip): signed out means out.
  const goWelcomeLocked = () => {
    AsyncStorage.removeItem(LOCAL_OK_KEY).catch(() => {});
    setShowWelcome(false);
    setShowLanding(true);
  };

  const goConnect = (from: Route) => {
    setConnectFrom(from);
    setRoute('connect');
  };

  // phone back button follows the route stack (tabs exit the app)
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const r = routeRef.current;
      if (r === 'export') {
        setRoute('editor');
        return true;
      }
      if (r === 'connect') {
        setRoute(connectFrom);
        return true;
      }
      if (r === 'privacy') {
        setRoute(privacyFrom);
        return true;
      }
      if (r === 'team') {
        setRoute(teamFrom);
        return true;
      }
      if (r === 'account') {
        setRoute('home');
        return true;
      }
      if (r === 'analytics') {
        setRoute(insightsFrom);
        return true;
      }
      if (r === 'community') {
        setRoute('home');
        return true;
      }
      if (r === 'editor' || r === 'size') {
        setRoute('create');
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openScheduled = async (projectId: string, pageId: string) => {
    try {
      const all = await loadProjects();
      const proj = all.find((p) => p.id === projectId);
      if (!proj) return;
      const idx = proj.pages.findIndex((x) => x.id === pageId);
      loadPost(proj);
      setPageIndex(Math.max(0, idx));
      setRoute('editor');
    } catch {}
  };

  // tapping a reminder deep-links straight to its post (lazy: module throws in Android Go)
  const composerRef = React.useRef({ openPostById, publishPostById });
  composerRef.current = { openPostById, publishPostById };
  React.useEffect(() => {
    let sub: { remove: () => void } | null = null;
    const openData = async (d: any) => {
      if (!d) return;
      if (d.managedPostId) {
        // land on the inline Post pill, then publish the due post
        setPostSignal(Date.now());
        setRoute('create');
        await composerRef.current.publishPostById(String(d.managedPostId));
        return;
      }
      if (d.projectId) openScheduled(d.projectId, d.pageId);
    };
    (async () => {
      try {
        // Android Expo Go has no notification module at all — skip silently
        // (appOwnership is gone in SDK 58; isRunningInExpoGo is the live check)
        if (isRunningInExpoGo() && Platform.OS === 'android') return;
        const NN = await import('expo-notifications');
        sub = NN.addNotificationResponseReceivedListener((resp: any) => {
          openData(resp.notification.request.content.data ?? {});
        });
        const last = await NN.getLastNotificationResponseAsync().catch(() => null);
        if (last) openData((last as any)?.notification.request.content.data ?? {});
      } catch {}
    })();
    return () => {
      try {
        sub?.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goCreatePost = () => {
    setPostSignal(Date.now());
    setRoute('create');
  };

  const newTemplate = () => {
    clearPost();
    setRoute('size');
  };

  if (!fontsLoaded || !welcomeReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bone }}>
        <ActivityIndicator size="large" color={C.ink} />
      </View>
    );
  }

  if (showLanding) {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bone }}>
          <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
          <LandingScreen
            onGetStarted={() => { setShowLanding(false); setShowWelcome(true); }}
            locale={account.locale}
            // Signed out: device only. Sign-up/sign-in carries it into the profile.
            onLocale={(l) => { void saveAccount({ locale: l }).then(setAccount); }}
          />
        </SafeAreaView>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Grain />
        </View>
      </View>
    );
  }

  if (showWelcome) {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bone }}>
          <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
          <WelcomeScreen
            onDone={(p) => { void enterFromWelcome(p); }}
          />
        </SafeAreaView>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Grain />
        </View>
      </View>
    );
  }

  // Dock shows on the four tab routes; the composer highlights Post.
  const isTab = route === 'home' || route === 'create' || route === 'analytics' || route === 'community' || route === 'account';
  const activeTab: MainTab | null =
    route === 'create' ? 'post' : route === 'community' ? 'community' : route === 'account' ? 'profile' : route === 'analytics' ? null : 'home';
  /** Insights opens from the header of Home or Post; back returns there. */
  const openInsights = (from: Route) => {
    setInsightsFrom(from);
    setRoute('analytics');
  };
  /** Plan the UI gates on: the server's when known, else the local fallback. */
  const planInternal = entitlement ? internalKeyFor(entitlement.plan) : account.plan;
  const goTab = (t: MainTab) => {
    if (t === 'home') setRoute('home');
    else if (t === 'post') goCreatePost();
    else if (t === 'community') setRoute('community');
    else setRoute('account');
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bone }}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View key={`ws-${wsEpoch}`} style={{ flex: 1 }}>
          {/* Tab screens stay mounted; only the active one is displayed. */}
          <View key={`tabs-${tabEpoch}`} style={{ flex: 1, display: isTab ? 'flex' : 'none' }}>
            {seenTabs.has('home') ? (
              <View style={{ flex: 1, display: route === 'home' ? 'flex' : 'none' }}>
                <DashboardScreen
                  team={account.team}
                  onConnect={() => goConnect('home')}
                  onPost={goCreatePost}
                  onAnalytics={() => openInsights('home')}
                />
              </View>
            ) : null}
            {seenTabs.has('create') ? (
              <View style={{ flex: 1, display: route === 'create' ? 'flex' : 'none' }}>
                <CreateScreen
                  onConnect={() => goConnect('create')}
                  onTemplate={newTemplate}
                  onOpenProject={(p) => { loadPost(p); setRoute('editor'); }}
                  postSignal={postSignal}
                  onConsumePostSignal={() => setPostSignal(0)}
                />
              </View>
            ) : null}
            {seenTabs.has('analytics') ? (
              <View style={{ flex: 1, display: route === 'analytics' ? 'flex' : 'none' }}>
                <AnalyticsScreen
                  onConnect={() => goConnect('analytics')}
                  onBack={() => setRoute(insightsFrom)}
                />
              </View>
            ) : null}
            {seenTabs.has('community') ? (
              <View style={{ flex: 1, display: route === 'community' ? 'flex' : 'none' }}>
                <CommunityScreen onConnect={() => goConnect('community')} />
              </View>
            ) : null}
            {seenTabs.has('account') ? (
              <View style={{ flex: 1, display: route === 'account' ? 'flex' : 'none' }}>
                <AccountScreen
                  email={account.email}
                  team={account.team}
                  plan={account.plan}
                  notifPosts={account.notifPosts}
                  notifComments={account.notifComments}
                  notifWeekly={account.notifWeekly}
                  notifMarketing={account.notifMarketing}
                  locale={account.locale}
                  onUpdate={patchAccount}
                  onBack={() => setRoute('create')}
                  onConnect={() => goConnect('account')}
                  onPrivacy={() => { setPrivacyFrom('account'); setRoute('privacy'); }}
                  onLoggedOut={goWelcomeLocked}
                  onTeam={() => { setTeamFrom('account'); setRoute('team'); }}
                />
              </View>
            ) : null}
          </View>
          {route === 'size' ? <SizeScreen onDone={() => setRoute('editor')} onBack={() => setRoute('create')} /> : null}
          {route === 'editor' ? <EditorScreen onExport={() => setRoute('export')} onHome={() => setRoute('home')} onPosts={goCreatePost} /> : null}
          {route === 'export' ? <ExportScreen onBack={() => setRoute('editor')} plan={account.plan} /> : null}
          {route === 'privacy' ? <PrivacyScreen onBack={() => setRoute(privacyFrom)} /> : null}
          {route === 'connect' ? <ConnectScreen onBack={() => { setTabEpoch((n) => n + 1); setRoute(connectFrom); }} plan={planInternal} channelCap={entitlement ? entitlement.limits.channels : undefined} onTeam={() => { setTeamFrom('connect'); setRoute('team'); }} /> : null}
          {route === 'team' ? (
            <TeamScreen
              plan={account.plan}
              email={account.email}
              teamName={account.team}
              onBack={() => setRoute(teamFrom)}
              onSeePlans={() => setRoute('account')}
              onSwitched={(ws) => void onTeamSwitched(ws)}
            />
          ) : null}
        </View>
        {isTab ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          >
            <BottomNav
              tab={activeTab}
              onTab={goTab}
              onTemplate={newTemplate}
              onPost={goCreatePost}
            />
          </View>
        ) : null}
        <Tour page={route === 'home' ? 'home' : route === 'create' ? 'post' : route === 'analytics' ? 'analytics' : route === 'community' ? 'community' : null} />
      </SafeAreaView>
      {/* single film-grain coat over the whole window incl. status/home strips,
          so the strips never read as a different color from the screens */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Grain />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <PostProvider>
          <ComposerProvider>
            <Shell />
          </ComposerProvider>
        </PostProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
