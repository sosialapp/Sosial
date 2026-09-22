import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase, currentSession } from './supabase';

/**
 * Owner-push device registration (Phase 3 of the owner console).
 *
 * Banner while the app is open (tap behavior unchanged). Set at module scope
 * so the first import (see registerPushToken callers) activates it.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
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
  const out: PushDiag = { permission: 'unavailable', token: null, projectId: false };
  try {
    const { status } = await Notifications.getPermissionsAsync();
    out.permission = status;
    const extra = Constants?.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId;
    out.projectId = !!projectId;
    if (status === 'granted' && projectId) {
      try {
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        out.token = data ?? null;
      } catch {
        out.token = null;
      }
    }
  } catch {}
  return out;
}

/**
 * Register this device for owner pushes. Best-effort, never throws:
 * - simulators and builds without push credentials fail at the token step
 * - signed-out users get permission + token but no row (next sign-in saves it)
 * Call fire-and-forget after every sign-in. Returns the Expo token or null.
 */
export async function registerPushToken(): Promise<string | null> {
  try {
    await ensureAndroidChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status =
      existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const extra = Constants?.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId;
    if (!projectId) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;
    const session = await currentSession().catch(() => null);
    if (!session) return token;
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
    if (error) return null;
    return token;
  } catch {
    return null;
  }
}
