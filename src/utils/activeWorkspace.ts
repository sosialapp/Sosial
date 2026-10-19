import * as SecureStore from 'expo-secure-store';

/**
 * The workspace this device is pinned to. Mirrors `WS_KEY` in `supabase.ts`,
 * which is set by `switchWorkspace()` / `myWorkspace()`.
 *
 * Kept in a leaf module (no imports from the cloud helpers) because both the
 * account store and the post store need it, and those two are imported by
 * each other's callers; pulling the Supabase client in would create a cycle.
 */
const WS_KEY = 'sosial_ws_id';

export async function activeWorkspaceId(): Promise<string | null> {
  try {
    const id = await SecureStore.getItemAsync(WS_KEY);
    return id && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/** `key` for the pinned workspace, or the unscoped key before login. */
export function scopedKey(key: string, workspaceId: string | null): string {
  return workspaceId ? `${key}:${workspaceId}` : key;
}
