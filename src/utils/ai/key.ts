import * as SecureStore from 'expo-secure-store';

const KEY = 'zap_gemini_key_v1';

/** Key baked into the build — Pro users run AI with zero setup, same pattern
 *  as the built-in TikTok photo host. A key saved on-device still wins. */
const BUILT_IN = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();

export function hasBuiltInKey(): boolean {
  return BUILT_IN.length > 0;
}

/** On-device override first, otherwise the built-in build key. */
export async function getAiKey(): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v && v.trim()) return v.trim();
  } catch {}
  return BUILT_IN || null;
}

export async function setAiKey(v: string): Promise<void> {
  try {
    if (v.trim()) await SecureStore.setItemAsync(KEY, v.trim());
    else await SecureStore.deleteItemAsync(KEY);
  } catch {}
}
