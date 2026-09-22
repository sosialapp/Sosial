import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, currentSession } from './supabase';

/**
 * Owner-push device registration (Phase 3 of the owner console).
 *
 * expo-notifications is NEVER statically imported: since SDK 53 the module
 * throws at load time inside Android Expo Go (remote push removed there),
 * which redboxes the whole bundle before first paint. Same lazy pattern as
 * reminders.ts — Expo Go callers get a clean "use a dev build" answer while
 * the standalone APK works fully. Banner presentation is set once the
 * module loads (tap behavior unchanged).
 */
let _mod: any = null;
let _tried = false;

async function N(): Promise<any | null> {
  if (_mod) return _mod;
  if (_tried) return null;
  _tried = true;
  // Android Expo Go removed the module (SDK 53+) — don't even attempt the
  // import: even a caught attempt surfaces a LogBox. Everything else loads it.
  if (Constants.appOwnership === 'expo' && Platform.OS === 'android') return null;
  try {
    _mod = await import('expo-notifications');
    try {
      _mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {}
    return _mod;
  } catch {
    return null;
  }
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function ensureAndroidChannel(NN: any): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await NN.setNotificationChannelAsync('default', {
      name: 'General',
      importance: NN.AndroidImportance.DEFAULT,
    });
  } catch {
    // channels are best-effort; pushes still arrive on the default channel
  }
}

export interface PushDiag {
  /** OS permission state: granted | denied | undetermined | unavailable */
  permission: string;
  /** token minted on-device (unsaved counts too — proves FCM works) */
  token: string | null;
  /** whether the build carries the EAS project id */
  projectId: boolean;
}

/** Read-only self-check: never prompts, never writes, never throws. */
export async function pushDiagnostics(): Promise<PushDiag> {
  const extra = Constants?.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const projectId = extra?.eas?.projectId;
  const out: PushDiag = { permission: 'unavailable', token: null, projectId: !!projectId };
  try {
    const NN = await N();
    if (!NN) return out;
    const { status } = await NN.getPermissionsAsync();
    out.permission = status;
    if (status === 'granted' && projectId) {
      try {
        const { data } = await NN.getExpoPushTokenAsync({ projectId });
        out.token = data ?? null;
      } catch {
        out.token = null;
      }
    }
  } catch {}
  return out;
}

export interface PushRegResult {
  token: string | null;
  /** machine-readable failure stage for the on-device diagnostic */
  stage: 'ok' | 'permission' | 'no-project' | 'no-token' | 'signed-out' | 'save-failed';
  detail?: string;
}

/**
 * Staged registration: same flow as registerPushToken but reports exactly
 * which step failed instead of collapsing to null.
 */
export async function registerPushTokenFull(): Promise<PushRegResult> {
  try {
    const NN = await N();
    if (!NN) {
      return {
        token: null,
        stage: 'no-token',
        detail: isExpoGo()
          ? 'Expo Go has no remote push — use a development build.'
          : 'Notifications module unavailable on this device.',
      };
    }
    await ensureAndroidChannel(NN);
    const { status: existing } = await NN.getPermissionsAsync();
    const status =
      existing === 'granted' ? existing : (await NN.requestPermissionsAsync()).status;
    if (status !== 'granted') return { token: null, stage: 'permission', detail: status };
    const extra = Constants?.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId;
    if (!projectId) return { token: null, stage: 'no-project' };
    let token: string | null = null;
    try {
      token = (await NN.getExpoPushTokenAsync({ projectId })).data ?? null;
    } catch (e: any) {
      return { token: null, stage: 'no-token', detail: String(e?.message ?? e).slice(0, 160) };
    }
    if (!token) return { token: null, stage: 'no-token', detail: 'empty token' };
    const session = await currentSession().catch(() => null);
    if (!session) return { token, stage: 'signed-out' };
    const { error } = await supabase()
      .from('push_tokens')
      .upsert(
        {
          user_id: session.user.id,
          workspace_id: session.workspace.id,
          expo_token: token,
          platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : '',
        },
        { onConflict: 'expo_token' },
      );
    if (error) {
      return { token, stage: 'save-failed', detail: error.message.slice(0, 160) };
    }
    return { token, stage: 'ok' };
  } catch (e: any) {
    return { token: null, stage: 'no-token', detail: String(e?.message ?? e).slice(0, 160) };
  }
}

/**
 * Register this device for owner pushes. Best-effort, never throws:
 * - Expo Go + simulators fail at the token step with a clear reason
 * - builds without push credentials fail at the token step
 * - signed-out users get permission + token but no row (next sign-in saves it)
 * Call fire-and-forget after every sign-in. Returns the Expo token or null.
 */
export async function registerPushToken(): Promise<string | null> {
  return (await registerPushTokenFull()).token;
}
