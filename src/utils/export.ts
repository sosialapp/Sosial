import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import type { QuickPost } from '../types';

/**
 * expo-media-library is loaded lazily (dynamic import) instead of a top-level
 * import, because old and new Expo Go apps ship DIFFERENT native modules:
 * - old Go (notably Android): only `ExpoMediaLibrary` (legacy entry works)
 * - new Go (notably iOS): only `ExpoMediaLibraryNext` (root entry works)
 * A top-level import crashes launch on whichever side lacks the module.
 * We probe root first, then legacy. Also note the root `saveToLibraryAsync`
 * is a stub that THROWS — the new API saves via `Asset.create()`.
 */
type MLHandle = { kind: 'next' | 'legacy'; mod: any };

// resolved once per session — probing the module and asking for permission on
// every save added seconds to each tap
let mlHandle: MLHandle | null | undefined;
let mlGranted = false;

/** The JS package loads even when the native side isn't in the binary
 *  (Expo Go versions, dev builds made before the package was added) — the
 *  failure then surfaces as a native-module error at call time. */
function isNativeMissing(e: any): boolean {
  return /cannot find native module|ExpoMediaLibrary|requireNativeModule/i.test(
    String(e?.message ?? e ?? ''),
  );
}

async function probeMediaLibrary(): Promise<MLHandle | null> {
  try {
    const mod = await import('expo-media-library');
    if (!mod.Asset || !mod.requestPermissionsAsync) throw new Error('no next api');
    return { kind: 'next', mod };
  } catch (e) {
    if (isNativeMissing(e)) return null; // no legacy entry can help — same native piece is missing
    // fall through to legacy
  }
  try {
    const mod = await import('expo-media-library/legacy');
    if (!mod.saveToLibraryAsync || !mod.requestPermissionsAsync) throw new Error('no legacy api');
    return { kind: 'legacy', mod };
  } catch {
    return null;
  }
}

async function getMediaLibrary(): Promise<MLHandle | null> {
  if (mlHandle === undefined) mlHandle = await probeMediaLibrary();
  return mlHandle;
}

/** 'granted' | 'denied' | 'unavailable' — unavailable means the native module
 *  itself is missing and the caller should use its fallbacks. */
async function requestPermission(ML: MLHandle | null): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!ML) return 'unavailable';
  if (mlGranted) return 'granted';
  try {
    const { status } = await ML.mod.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to save your posts.');
      return 'denied';
    }
    mlGranted = true;
    return 'granted';
  } catch (e) {
    if (isNativeMissing(e)) {
      mlHandle = null;
      return 'unavailable';
    }
    return 'denied';
  }
}

export async function ensureMediaPermission(): Promise<boolean> {
  return (await requestPermission(await getMediaLibrary())) === 'granted';
}

/** Rejects if `p` hasn't settled in `ms` — native capture/save calls have
 *  hung forever on some devices, leaving the UI spinner stuck with no error.
 *  A timeout converts that into a named failure the UI can report. */
function withTimeout<T>(p: Promise<T>, ms: number, stage: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${stage} timed out — please try again.`)), ms);
  });
  return Promise.race([p, guard]).finally(() => {
    if (t !== undefined) clearTimeout(t);
  });
}

async function saveOne(ML: MLHandle, uri: string): Promise<void> {
  const write = ML.kind === 'next'
    ? ML.mod.Asset.create(uri)
    : ML.mod.saveToLibraryAsync(uri);
  await withTimeout(write, 30000, 'Gallery write');
}

/** Capture a single ViewShot ref to a tmp png file.
 *  The tmpfile is returned as-is — an extra copy just doubled the file I/O. */
export async function capturePage(ref: any, tag: string): Promise<string> {
  if (!ref) throw new Error('Nothing to capture — the page view is missing.');
  try {
    return await withTimeout(
      captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' }),
      20000,
      `Capture ${tag}`,
    );
  } catch (e: any) {
    if (/timed out/.test(e?.message ?? '')) throw e;
    throw new Error('Failed to capture page');
  }
}

/** Android fallback when the gallery native module is missing: let the user
 * pick a folder (e.g. Downloads) and write the PNGs there via Storage Access Framework. */
async function saveViaSAF(uris: string[]): Promise<number> {
  const SAF = (FileSystem as any).StorageAccessFramework;
  if (!SAF) return 0;
  try {
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return 0;
    let saved = 0;
    for (let i = 0; i < uris.length; i++) {
      try {
        await withTimeout((async () => {
          const base64 = await FileSystem.readAsStringAsync(uris[i], {
            encoding: FileSystem.EncodingType.Base64,
          });
          const fileUri = await SAF.createFileAsync(
            perm.directoryUri,
            `quickpost_${Date.now()}_${i}.png`,
            'image/png',
          );
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        })(), 60000, 'Folder write');
        saved++;
      } catch (e) {
        console.warn('saf save failed', e);
      }
    }
    if (saved > 0) {
      Alert.alert('Saved', `Saved ${saved}/${uris.length} image(s) to the folder you picked.`);
    }
    return saved;
  } catch (e) {
    console.warn('saf failed', e);
    return 0;
  }
}

/** Capture every page ref to tmp png files (used by "Save all"). */
export async function saveAllImages(refs: any[], post: QuickPost, _sizeRatio: number): Promise<string[]> {
  const uris: string[] = [];
  for (let i = 0; i < post.pages.length; i++) {
    const ref = refs[i];
    if (!ref) continue;
    const uri = await capturePage(ref, `p${i}`);
    uris.push(uri);
  }
  if (uris.length === 0) throw new Error('Could not capture pages.');
  return uris;
}

/** Save URIs to the photo library, falling back to folder-save on Android
 *  and the share sheet elsewhere when the gallery write fails (Expo Go can't
 *  write to the media library, and dev builds without the native module
 *  surface the same failure at call time). */
export async function saveUrisToGallery(uris: string[], opts?: { silent?: boolean }) {
  const ML = await getMediaLibrary();
  if (ML) {
    const perm = await requestPermission(ML);
    if (perm === 'denied') return 0;
    let saved = 0;
    let nativeMissing = perm === 'unavailable';
    const failed: string[] = [];
    for (const u of uris) {
      try {
        await saveOne(ML, u);
        saved++;
      } catch (e) {
        console.warn('save failed', e);
        if (isNativeMissing(e)) {
          // The probe passed but the native side is gone — stop trusting it
          // and fall back for everything that hasn't saved yet.
          nativeMissing = true;
          mlHandle = null;
          break;
        }
        failed.push(u);
      }
    }
    if (!nativeMissing) {
      if (saved === uris.length) {
        // per-page saves show an inline tick, so skip the modal that slowed them down
        if (!opts?.silent) Alert.alert('Saved', `Saved ${saved}/${uris.length} image(s) to your gallery.`);
        return saved;
      }
      // Gallery write failed (typical on Android Expo Go) — save the rest to a folder
      if (Platform.OS === 'android' && failed.length > 0) {
        const viaFolder = await saveViaSAF(failed);
        if (viaFolder > 0) {
          if (saved > 0) {
            Alert.alert('Saved', `${saved} image(s) went to your gallery, ${viaFolder} to the folder you picked.`);
          }
          return saved + viaFolder;
        }
      }
      Alert.alert(
        'Could not save',
        saved > 0
          ? `Only ${saved}/${uris.length} image(s) saved. Please try again.`
          : 'The gallery refused the images. Please try again.',
      );
      return saved;
    }
    // nativeMissing → retry everything unsaved through the fallbacks below.
    const remaining = uris.slice(saved);
    if (Platform.OS === 'android') {
      const viaFolder = await saveViaSAF(remaining);
      if (viaFolder > 0) {
        if (saved > 0) {
          Alert.alert('Saved', `${saved} image(s) went to your gallery, ${viaFolder} to the folder you picked.`);
        }
        return saved + viaFolder;
      }
    }
    uris = remaining;
  } else if (Platform.OS === 'android') {
    // Gallery native module missing — let the user pick a folder via SAF.
    const saved = await saveViaSAF(uris);
    if (saved > 0) return saved;
  }
  // Last resort on any platform: the share sheet (iOS "Save Image", Android
  // share targets) still gets the picture out of the app.
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uris[0], { dialogTitle: 'Save or share', mimeType: 'image/png', UTI: 'public.png' });
      if (uris.length > 1) {
        Alert.alert('Shared', 'The rest are still in the app — share them one by one, or update Expo Go / rebuild the app for direct gallery saves.');
      }
      return uris.length;
    }
  } catch {
    /* fall through to the final alert */
  }
  Alert.alert(
    'Gallery unavailable',
    'This Expo Go version cannot save to the gallery. Update Expo Go to the latest version, or rebuild the app so the gallery module is included.',
  );
  return 0;
}

/** Share a single file */
export async function shareSingleFile(uri: string) {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(uri, { dialogTitle: 'Share your Sosial', mimeType: 'image/png', UTI: 'public.png' });
  } catch {
    Alert.alert('Share failed', 'Could not share file.');
  }
}
