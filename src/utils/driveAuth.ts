/**
 * Google Drive + Google Photos OAuth (device-side, same confidential Google
 * client as YouTube — secrets already baked per the TikTok precedent).
 * drive.readonly + photoslibrary.readonly are requested together so one
 * consent covers both pickers. Tokens live in SecureStore (never the cloud);
 * downloads happen at pick time and flow through the normal pipeline after.
 */

import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_AUTH_ENDPOINT, YT_TOKEN_ENDPOINT } from './ytConfig';
import { BRIDGE_URL, appReturnUrl } from './metaAuth';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/photoslibrary.readonly'];
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const PHOTOS_API = 'https://photoslibrary.googleapis.com/v1';
const STORE_KEY = 'sosial_src_google_files_v1';

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

function qs(p: Record<string, string>): string {
  return Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export async function filesConnected(): Promise<boolean> {
  const t = await readStored();
  return !!t?.refreshToken;
}

/** Forget Google Drive/Photos tokens on this device. */
export async function disconnectGoogleFiles(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {}
}

/** System-browser consent; returns true when the provider redirected back. */
export async function loginGoogleFiles(): Promise<boolean> {
  const url =
    `${YT_AUTH_ENDPOINT}?response_type=code` +
    `&client_id=${encodeURIComponent(YT_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(BRIDGE_URL)}` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(appReturnUrl())}`;
  try {
    await (WebBrowser as any).dismissBrowser?.();
  } catch {}
  try {
    const res = await WebBrowser.openAuthSessionAsync(url, appReturnUrl(), {
      preferEphemeralSession: false,
    });
    if (res.type !== 'success' || !('url' in res) || !res.url) return false;
    const m = String(res.url).match(/[?&#]code=([^&]+)/);
    const code = m?.[1] ? decodeURIComponent(m[1]) : '';
    if (!code) return false;
    await exchangeGoogleFilesCode(code);
    return true;
  } catch {
    return false;
  }
}

async function exchangeGoogleFilesCode(code: string): Promise<StoredTokens> {
  const r = await fetch(YT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs({
      code,
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      redirect_uri: BRIDGE_URL,
      grant_type: 'authorization_code',
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token || !j?.refresh_token) {
    throw new Error(`Google login failed. ${String(j?.error_description ?? j?.error ?? `HTTP ${r.status}`).slice(0, 120)}`);
  }
  const t: StoredTokens = {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token),
    expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
  };
  await writeStored(t);
  return t;
}

/** Valid access token (refresh-first when stale). */
export async function getValidGoogleFilesToken(): Promise<string> {
  const t = await readStored();
  if (t && t.expiresAt > Date.now() + 60000 && t.accessToken) return t.accessToken;
  if (!t?.refreshToken) throw new Error('Connect Google Drive / Photos first.');
  const r = await fetch(YT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs({
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token) throw new Error('Google session expired — reconnect Drive / Photos.');
  const next: StoredTokens = {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token ?? t.refreshToken),
    expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
  };
  await writeStored(next);
  return next.accessToken;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video';
  thumb?: string;
}

/** Images + videos in a folder (root when omitted), newest first. */
export async function listDriveFiles(folderId?: string, query?: string, pageToken?: string): Promise<{ files: DriveFile[]; nextPage?: string }> {
  const token = await getValidGoogleFilesToken();
  const clauses = [
    'trashed = false',
    `(mimeType contains 'image/' or mimeType contains 'video/')`,
    folderId && folderId !== 'root' ? `'${folderId.replace(/'/g, '')}' in parents` : null,
    query?.trim() ? `name contains '${query.trim().replace(/'/g, '')}'` : null,
  ].filter(Boolean) as string[];
  const params: Record<string, string> = {
    q: clauses.join(' and '),
    pageSize: '50',
    orderBy: 'modifiedTime desc',
    fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink)',
    ...(pageToken ? { pageToken } : {}),
  };
  const r = await fetch(`${DRIVE_API}/files?${qs(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `Drive refused the list (HTTP ${r.status}).`);
  const files: DriveFile[] = ((j?.files ?? []) as any[]).map((f: any) => ({
    id: String(f?.id ?? ''),
    name: String(f?.name ?? 'File'),
    mimeType: String(f?.mimeType ?? ''),
    kind: (String(f?.mimeType ?? '').startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
    thumb: typeof f?.thumbnailLink === 'string' ? f.thumbnailLink : undefined,
  })).filter((f) => f.id);
  return { files, nextPage: typeof j?.nextPageToken === 'string' ? j.nextPageToken : undefined };
}

/** Drive folders in a folder (root when omitted) for navigation. */
export async function listDriveFolders(folderId?: string): Promise<{ id: string; name: string }[]> {
  const token = await getValidGoogleFilesToken();
  const params: Record<string, string> = {
    q: `trashed = false and mimeType = 'application/vnd.google-apps.folder'${folderId && folderId !== 'root' ? ` and '${folderId.replace(/'/g, '')}' in parents` : ''}`,
    pageSize: '50',
    orderBy: 'name',
    fields: 'files(id,name)',
  };
  const r = await fetch(`${DRIVE_API}/files?${qs(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `Drive refused the list (HTTP ${r.status}).`);
  return ((j?.files ?? []) as any[]).map((f: any) => ({ id: String(f?.id ?? ''), name: String(f?.name ?? 'Folder') })).filter((f) => f.id);
}

export interface PhotosItem {
  id: string;
  kind: 'image' | 'video';
  thumb: string;
  baseUrl: string;
}
/** Google Photos library, newest first (search when query given). */
export async function listGooglePhotos(query?: string, pageToken?: string): Promise<{ items: PhotosItem[]; nextPage?: string }> {
  const token = await getValidGoogleFilesToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let j: any;
  if (query?.trim()) {
    const r = await fetch(`${PHOTOS_API}/mediaItems:search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        q: query.trim(),
        pageSize: 50,
        ...(pageToken ? { pageToken } : {}),
        filters: { mediaTypeFilter: { mediaTypes: ['ALL_MEDIA'] } },
      }),
    });
    j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message ?? `Photos refused the search (HTTP ${r.status}).`);
  } else {
    const params: Record<string, string> = { pageSize: '50', ...(pageToken ? { pageToken } : {}) };
    const r = await fetch(`${PHOTOS_API}/mediaItems?${qs(params)}`, { headers });
    j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message ?? `Photos refused the list (HTTP ${r.status}).`);
  }
  const items: PhotosItem[] = ((j?.mediaItems ?? []) as any[]).map((m: any) => {
    const md = m?.mediaMetadata ?? {};
    const isVideo = md?.video !== undefined;
    const base = String(m?.baseUrl ?? '');
    return {
      id: String(m?.id ?? ''),
      kind: (isVideo ? 'video' : 'image') as 'image' | 'video',
      thumb: base ? `${base}=w256-h256-c` : '',
      baseUrl: base,
    };
  }).filter((x) => x.id && x.baseUrl);
  return { items, nextPage: typeof j?.nextPageToken === 'string' ? j.nextPageToken : undefined };
}

/* ------------------------------- downloads ------------------------------ */

/** Drive file → sandbox file (auth header on the download). */
export async function downloadDriveFile(file: DriveFile): Promise<{ uri: string; kind: 'image' | 'video' }> {
  const token = await getValidGoogleFilesToken();
  const ext = file.kind === 'video' ? 'mp4' : 'jpg';
  const dest = `${FileSystem.documentDirectory}drive/${file.id}.${ext}`;
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}drive/`, { intermediates: true });
  } catch {}
  const dl = await FileSystem.downloadAsync(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    dest,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (dl.status !== 200) throw new Error('Drive download failed — try another file.');
  return { uri: dl.uri, kind: file.kind };
}

/** Photos item → sandbox file (baseUrl +=d serves the original bytes). */
export async function downloadPhotosItem(item: PhotosItem): Promise<{ uri: string; kind: 'image' | 'video' }> {
  const ext = item.kind === 'video' ? 'mp4' : 'jpg';
  const dest = `${FileSystem.documentDirectory}photos/${item.id}.${ext}`;
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}photos/`, { intermediates: true });
  } catch {}
  const dl = await FileSystem.downloadAsync(`${item.baseUrl}=d`, dest);
  if (dl.status !== 200) throw new Error('Photos download failed — try another one.');
  return { uri: dl.uri, kind: item.kind };
}
