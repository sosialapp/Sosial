/**
 * OneDrive (Microsoft Graph) OAuth + browse/download — device-side.
 * Confidential client secret is held by the cloud-exchange edge fn (this
 * app only relays the code); tokens live in SecureStore, cloud-synced
 * through media-integration like Dropbox/Canva.
 */

import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import { callEdgeFunction } from './supabase';
import { BRIDGE_URL, appReturnUrl } from './metaAuth';

const SCOPES = 'offline_access Files.Read.All User.Read';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const STORE_KEY = 'sosial_src_onedrive_v1';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

async function readStored(): Promise<StoredTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<StoredTokens>;
    if (typeof j.accessToken !== 'string' || typeof j.refreshToken !== 'string') return null;
    return { accessToken: j.accessToken, refreshToken: j.refreshToken, expiresAt: Number(j.expiresAt ?? 0) };
  } catch {
    return null;
  }
}

async function writeStored(t: StoredTokens): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(t));
  } catch {}
}

export async function oneDriveConnected(): Promise<boolean> {
  return !!(await readStored())?.accessToken;
}

export async function disconnectOneDrive(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {}
}

/** Public client id from oauth-config; the secret never touches the device. */
async function clientId(): Promise<string> {
  const j: any = await callEdgeFunction('oauth-config', {});
  const id = j?.onedrive?.client_id;
  if (!id) throw new Error('OneDrive is not configured yet — try again shortly.');
  return String(id);
}

/** System-browser consent; returns true when the provider redirected back. */
export async function loginOneDrive(): Promise<boolean> {
  const cid = await clientId();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cid,
    redirect_uri: BRIDGE_URL,
    scope: SCOPES,
    response_mode: 'query',
    state: appReturnUrl(),
  });
  try {
    await (WebBrowser as any).dismissBrowser?.();
  } catch {}
  try {
    const res = await WebBrowser.openAuthSessionAsync(
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`,
      appReturnUrl(),
      { preferEphemeralSession: false },
    );
    if (res.type !== 'success' || !('url' in res) || !res.url) return false;
    const m = String(res.url).match(/[?&#]code=([^&]+)/);
    const code = m?.[1] ? decodeURIComponent(m[1]) : '';
    if (!code) return false;
    const j: any = await callEdgeFunction('cloud-exchange', {
      provider: 'onedrive',
      code,
      redirect_uri: BRIDGE_URL,
    });
    if (!j?.access_token) throw new Error('Microsoft hid the login — try again.');
    const t: StoredTokens = {
      accessToken: String(j.access_token),
      refreshToken: String(j.refresh_token ?? ''),
      expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
    };
    await writeStored(t);
    void syncCloud('onedrive', t);
    return true;
  } catch {
    return false;
  }
}

/** Fresh access token (refresh-first; Microsoft rotates refresh tokens). */
export async function getValidOneDriveToken(): Promise<string> {
  const t = await readStored();
  if (!t) throw new Error('Connect OneDrive first.');
  if (t.expiresAt > Date.now() + 60_000) return t.accessToken;
  const j: any = await callEdgeFunction('cloud-exchange', {
    provider: 'onedrive',
    refresh_token: t.refreshToken,
  });
  if (!j?.access_token) throw new Error('OneDrive session expired — reconnect the source.');
  const next: StoredTokens = {
    accessToken: String(j.access_token),
    refreshToken: typeof j.refresh_token === 'string' && j.refresh_token ? j.refresh_token : t.refreshToken,
    expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
  };
  await writeStored(next);
  void syncCloud('onedrive', next);
  return next.accessToken;
}

async function syncCloud(provider: string, t: StoredTokens): Promise<void> {
  try {
    await callEdgeFunction('media-integration', {
      provider,
      access_token: t.accessToken,
      refresh_token: t.refreshToken,
      expires_in: Math.max(60, Math.round((t.expiresAt - Date.now()) / 1000)),
    });
  } catch {}
}

const OD_MEDIA = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'mp4', 'mov', 'webm', 'm4v'];

export interface OneDriveItem {
  id: string;
  name: string;
  kind: 'image' | 'video';
  thumb?: string;
}

function odKind(name: string): 'image' | 'video' | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video';
  if (OD_MEDIA.includes(ext)) return 'image';
  return null;
}

/** Browse OneDrive: folder children or whole-drive search (media only). */
export async function listOneDriveItems(
  folderId?: string,
  query?: string,
): Promise<{ files: OneDriveItem[]; folders: { id: string; name: string }[] }> {
  const token = await getValidOneDriveToken();
  const auth = { Authorization: `Bearer ${token}` };
  const path = query && query.trim()
    ? `${GRAPH}/me/drive/root/search(q='${encodeURIComponent(query.trim().replace(/["']/g, ''))}')?$top=50`
    : folderId
      ? `${GRAPH}/me/drive/items/${folderId}/children?$top=100`
      : `${GRAPH}/me/drive/root/children?$top=100`;
  const res = await fetch(path, { headers: auth, signal: AbortSignal.timeout(20000) });
  if (res.status === 401) throw new Error('OneDrive session expired — reconnect the source.');
  if (!res.ok) throw new Error('OneDrive browse failed — try again.');
  const j: any = await res.json().catch(() => ({}));
  const files: OneDriveItem[] = [];
  const folders: { id: string; name: string }[] = [];
  for (const it of (j?.value ?? []) as any[]) {
    if (it?.folder) {
      folders.push({ id: String(it.id), name: String(it.name ?? 'Folder') });
      continue;
    }
    const kind = odKind(String(it?.name ?? ''));
    if (!kind) continue;
    files.push({
      id: String(it.id),
      name: String(it.name ?? 'file'),
      kind,
      ...(it?.thumbnails?.small?.url ? { thumb: String(it.thumbnails.small.url) } : {}),
    });
  }
  return { files, folders };
}

/** Download one item as a composer-ready attachment. */
export async function downloadOneDriveItem(
  item: OneDriveItem,
): Promise<{ uri: string; kind: 'image' | 'video' }> {
  const token = await getValidOneDriveToken();
  const metaRes = await fetch(`${GRAPH}/me/drive/items/${item.id}?select=@microsoft.graph.downloadUrl,name`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  let url = `${GRAPH}/me/drive/items/${item.id}/content`;
  if (metaRes.ok) {
    const j: any = await metaRes.json().catch(() => ({}));
    if (j?.['@microsoft.graph.downloadUrl']) url = String(j['@microsoft.graph.downloadUrl']);
  }
  // The pre-authed downloadUrl needs no Authorization header; the plain
  // content endpoint does — send both safely (Graph ignores extra headers).
  const safeName = item.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const ext = item.kind === 'video' ? 'mp4' : 'jpg';
  const dest = `${FileSystem.documentDirectory}onedrive/${Date.now()}_${safeName || `file.${ext}`}`;
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}onedrive/`, { intermediates: true });
  } catch {}
  const dl = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { uri: dl.uri, kind: item.kind };
}
