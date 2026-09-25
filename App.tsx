import React, { useState } from 'react';
import { StatusBar, ActivityIndicator, View, Text, BackHandler, Platform, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PostProvider, usePost } from './src/store/PostContext';
import { ComposerProvider, useComposer } from './src/store/ComposerContext';
import { loadProjects } from './src/screens/HomeScreen';
import CreateScreen from './src/screens/CreateScreen';
import WelcomeScreen, { WelcomeProfile } from './src/screens/WelcomeScreen';
import LandingScreen from './src/screens/LandingScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import AccountScreen from './src/screens/AccountScreen';
import SizeScreen from './src/screens/SizeScreen';
import EditorScreen from './src/screens/EditorScreen';
import ExportScreen from './src/screens/ExportScreen';
import ConnectScreen from './src/screens/ConnectScreen';
import TeamScreen from './src/screens/TeamScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import BottomNav, { MainTab } from './src/components/BottomNav';
import ProfileMenu from './src/components/ProfileMenu';
import Grain from './src/components/Grain';
import { useFontsLoaded } from './src/utils/fonts';
import { loadAccount, saveAccount, Account } from './src/utils/account';
import { pushProfileToCloud, currentSession, isSupabaseConfigured } from './src/utils/supabase';
import { handleAuthUrl, getPendingAuth } from './src/utils/authFlow';
import { backfillMissingAvatars } from './src/utils/avatarBackfill';
import { pullCloudChannels } from './src/utils/cloudChannels';
import { useTheme, ThemeProvider } from './src/theme';

type Route = MainTab | 'size' | 'editor' | 'export' | 'connect' | 'privacy' | 'account' | 'team';

// Canvas is a fixed-size export artifact — ignore the OS font-size setting
// so it renders pixel-identical on every device (esp. Android). Also kill
// Android's extra font padding, which shifts every line box vs iOS.
(Text as any).defaultProps = { ...((Text as any).defaultProps ?? {}), allowFontScaling: false, includeFontPadding: false };

const TABS: MainTab[] = ['create', 'analytics'];

// First-run gate: fresh installs land on the landing screen unless a cloud
// session already exists. Skipping persists as local-only mode (dashboard on
// open); signing out clears it so the next open lands back on landing.
const WELCOME_SEEN_KEY = 'zap_welcome_seen_v1';
const LOCAL_OK_KEY = 'zap_local_ok_v1';

function Shell() {
  const { C, mode, toggle } = useTheme();
  const { openPostById, publishPostById } = useComposer();
  const [route, setRoute] = useState<Route>('create');
  const [connectFrom, setConnectFrom] = useState<Route>('create');
  const [privacyFrom, setPrivacyFrom] = useState<Route>('account');
  const [teamFrom, setTeamFrom] = useState<Route>('create');
  const [profileOpen, setProfileOpen] = useState(false);
  const [postSignal, setPostSignal] = useState(0);
  const [account, setAccount] = useState<Account>({ email: '', team: 'My team', plan: 'free', notifPosts: true, notifComments: true, notifWeekly: false });
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  // True after an explicit sign-out: welcome returns without the skip escape.
  const [welcomeLocked, setWelcomeLocked] = useState(false);
  const { loadPost, clearPost, setPageIndex } = usePost();
  const fontsLoaded = useFontsLoaded();
  const routeRef = React.useRef(route);
  routeRef.current = route;

  React.useEffect(() => {
    loadAccount().then(setAccount);
    // One-shot picture backfill for pre-avatar accounts (throttled daily,
    // silent) - pushes fresh pictures to the cloud for the web marks.
    backfillMissingAvatars().catch(() => {});
    // Cloud → device channel pull on open + foreground (throttled inside):
    // web-side connects/disconnects show up here without visiting Connect.
    void pullCloudChannels().catch(() => {});
    // Content sync: web-created posts join the queue, ideas/templates saved
    // on either side converge (best-effort, silent).
    void (async () => {
      const [{ syncIdeas }, { syncTemplates }, { pullCloudPosts }] = await Promise.all([
        import('./src/utils/ideas'),
        import('./src/utils/presets'),
        import('./src/utils/cloudPosts'),
      ]);
      await syncIdeas().catch(() => null);
      await syncTemplates().catch(() => null);
      await pullCloudPosts().catch(() => null);
    })();
    const subState = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void pullCloudChannels().catch(() => {});
        void (async () => {
          const [{ syncIdeas }, { syncTemplates }, { pullCloudPosts }] = await Promise.all([
            import('./src/utils/ideas'),
            import('./src/utils/presets'),
            import('./src/utils/cloudPosts'),
          ]);
          await syncIdeas().catch(() => null);
          await syncTemplates().catch(() => null);
          await pullCloudPosts().catch(() => null);
        })();
      }
    });
    return () => subState.remove();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
        if (!isSupabaseConfigured()) {
          if (!seen) setShowLanding(true);
          return;
        }
        const s = await currentSession().catch(() => null);
        if (s) return;
        // No session: fresh installs land, skippers go straight in, and the
        // signed-out land back here too.
        if (seen) {
          const localOk = await AsyncStorage.getItem(LOCAL_OK_KEY).catch(() => null);
          if (localOk) return;
        }
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

  const dismissWelcome = async (skip?: boolean) => {
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
      if (skip) await AsyncStorage.setItem(LOCAL_OK_KEY, '1');
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
    });
    await dismissWelcome();
    try { await AsyncStorage.removeItem(LOCAL_OK_KEY); } catch {}
    setWelcomeLocked(false);
    setRoute('create');
  };

  // Any sign-out lands back on landing (auth behind it, no skip): signed out means out.
  const goWelcomeLocked = () => {
    setWelcomeLocked(true);
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
        setRoute('create');
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
        if (Constants.appOwnership === 'expo' && Platform.OS === 'android') return;
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

  const support = () => {
    Alert.alert('Support', 'Need help? Email pestelbiz@gmail.com and we’ll get back to you.');
  };

  const logout = () => {
    Alert.alert('Logout', 'Sign out on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await patchAccount({ email: '' });
          goWelcomeLocked();
        },
      },
    ]);
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
            onSkip={() => { void dismissWelcome(true); }}
            allowSkip={!welcomeLocked}
          />
        </SafeAreaView>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Grain />
        </View>
      </View>
    );
  }

  const isTab = (TABS as string[]).includes(route);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bone }}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={{ flex: 1 }}>
          {route === 'create' ? (
            <CreateScreen
              email={account.email}
              team={account.team}
              onProfile={() => setProfileOpen(true)}
              onConnect={() => goConnect('create')}
              onTemplate={newTemplate}
              onOpenProject={(p) => { loadPost(p); setRoute('editor'); }}
              postSignal={postSignal}
              onConsumePostSignal={() => setPostSignal(0)}
            />
          ) : null}
          {route === 'analytics' ? (
            <AnalyticsScreen
              email={account.email}
              team={account.team}
              onProfile={() => setProfileOpen(true)}
              onConnect={() => goConnect('analytics')}
            />
          ) : null}
          {route === 'size' ? <SizeScreen onDone={() => setRoute('editor')} onBack={() => setRoute('create')} /> : null}
          {route === 'editor' ? <EditorScreen onExport={() => setRoute('export')} onHome={() => setRoute('create')} onPosts={goCreatePost} /> : null}
          {route === 'export' ? <ExportScreen onBack={() => setRoute('editor')} plan={account.plan} /> : null}
          {route === 'account' ? (
            <AccountScreen
              email={account.email}
              team={account.team}
              plan={account.plan}
              notifPosts={account.notifPosts}
              notifComments={account.notifComments}
              notifWeekly={account.notifWeekly}
              onUpdate={patchAccount}
              onBack={() => setRoute('create')}
              onConnect={() => goConnect('account')}
              onPrivacy={() => { setPrivacyFrom('account'); setRoute('privacy'); }}
              onLoggedOut={goWelcomeLocked}
              onTeam={() => { setTeamFrom('account'); setRoute('team'); }}
            />
          ) : null}
          {route === 'privacy' ? <PrivacyScreen onBack={() => setRoute(privacyFrom)} /> : null}
          {route === 'connect' ? <ConnectScreen onBack={() => setRoute(connectFrom)} onTeam={() => { setTeamFrom('connect'); setRoute('team'); }} /> : null}
          {route === 'team' ? (
            <TeamScreen
              plan={account.plan}
              email={account.email}
              teamName={account.team}
              onBack={() => setRoute(teamFrom)}
              onSeePlans={() => setRoute('account')}
            />
          ) : null}
        </View>
        {isTab ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          >
            <BottomNav
              tab={route as MainTab}
              onTab={setRoute}
              onTemplate={newTemplate}
              onPost={goCreatePost}
            />
          </View>
        ) : null}
        <ProfileMenu
          visible={profileOpen}
          email={account.email}
          team={account.team}
          dark={mode === 'dark'}
          onToggleDark={toggle}
          onClose={() => setProfileOpen(false)}
          onAccount={() => setRoute('account')}
          onSupport={support}
          onLogout={logout}
        />
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
