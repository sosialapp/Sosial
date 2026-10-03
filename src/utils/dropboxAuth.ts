/**
 * Dropbox OAuth + browser (device-side SecureStore tokens; app key/secret
 * baked per the TikTok precedent — the owner pasted them explicitly).
 * Scopes: files.metadata.read + files.content.read (read-only).
 * Downloads happen at pick time and flow through the normal pipeline after.
 */

import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import { BRIDGE_URL, appReturnUrl } from './metaAuth';

const APP_KEY = 'emq623yv061pub5';
const APP_SECRET = 'rn99za30h2s77hh';
const SCOPES = 'files.metadata.read files.content.read';
const AUTH_ENDPOINT = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_ENDPOINT = 'https://api.dropboxapi.com/oauth2/token';
const RPC_ENDPOINT = 'https://api.dropboxapi.com/2';
const CONTENT_ENDPOINT = 'https://content.dropboxapi.com/2';
const STORE_KEY = 'sosial_src_dropbox_v1';

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

export async function dropboxConnected(): Promise<boolean> {
  const t = await readStored();
  return !!t?.refreshToken;
}

/** System-browser consent; returns true when Dropbox redirected back. */
export async function loginDropbox(): Promise<boolean> {
  const url =
    `${AUTH_ENDPOINT}?response_type=code` +
    `&client_id=${encodeURIComponent(APP_KEY)}` +
    `&redirect_uri=${encodeURIComponent(BRIDGE_URL)}` +
    `&token_access_type=offline` +
    `&scope=${encodeURIComponent(SCOPES)}` +
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
    await exchangeDropboxCode(code);
    return true;
  } catch {
    return false;
  }
}

async function exchangeDropboxCode(code: string): Promise<StoredTokens> {
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs({
      code,
      grant_type: 'authorization_code',
      client_id: APP_KEY,
      client_secret: APP_SECRET,
      redirect_uri: BRIDGE_URL,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token || !j?.refresh_token) {
    throw new Error(`Dropbox login failed. ${String(j?.error_description ?? j?.error ?? `HTTP ${r.status}`).slice(0, 120)}`);
  }
  const t: StoredTokens = {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token),
    expiresAt: Date.now() + Number(j.expires_in ?? 14400) * 1000,
  };
  await writeStored(t);
  return t;
}

/** Valid access token (refresh-first when stale). */
export async function getValidDropboxToken(): Promise<string> {
  const t = await readStored();
  if (t && t.expiresAt > Date.now() + 60000 && t.accessToken) return t.accessToken;
  if (!t?.refreshToken) throw new Error('Connect Dropbox first.');
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs({
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
      client_id: APP_KEY,
      client_secret: APP_SECRET,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token) throw new Error('Dropbox session expired — reconnect Dropbox.');
  const next: StoredTokens = {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token ?? t.refreshToken),
    expiresAt: Date.now() + Number(j.expires_in ?? 14400) * 1000,
  };
  await writeStored(next);
  return next.accessToken;
}

export interface DropboxEntry {
  kind: 'image' | 'video' | 'folder';
  name: string;
  path: string;
  thumb?: string;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i;

function entryKind(name: string, mediaTag?: string): 'image' | 'video' | null {
  if (mediaTag === 'photo') return 'image';
  if (mediaTag === 'video') return 'video';
  if (IMAGE_EXT.test(name)) return 'image';
  if (VIDEO_EXT.test(name)) return 'video';
  return null;
}

/** One folder level (root when path empty): folders + images/videos. */
export async function listDropboxFolder(path?: string): Promise<{ folders: DropboxEntry[]; files: DropboxEntry[] }> {
  const token = await getValidDropboxToken();
  const r = await fetch(`${RPC_ENDPOINT}/files/list_folder`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: path && path.length ? path : '',
      recursive: false,
      limit: 500,
      include_media_info: true,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error_summary ?? j?.error?.['.tag'] ?? `HTTP ${r.status}`;
    throw new Error(`Dropbox refused the list (${String(msg).slice(0, 100)}).`);
  }
  const folders: DropboxEntry[] = [];
  const files: DropboxEntry[] = [];
  for (const e of ((j?.entries ?? []) as any[])) {
    if (e?.['.tag'] === 'folder') {
      folders.push({ kind: 'folder', name: String(e?.name ?? 'Folder'), path: String(e?.path_lower ?? '') });
    } else if (e?.['.tag'] === 'file') {
      const kind = entryKind(String(e?.name ?? ''), e?.media_info?.['.tag']);
      if (kind) files.push({ kind, name: String(e?.name ?? 'File'), path: String(e?.path_lower ?? '') });
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  const images = files.filter((f) => f.kind === 'image');
  if (images.length) {
    try {
      const tr = await fetch(`${RPC_ENDPOINT}/files/get_thumbnail_batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // Struct params take no entry-level '.tag' (Dropbox 400s on unknown
        // fields); format/size are unions so tagged objects or shorthand
        // both work. No `mode` — server default converts HEIC etc. Videos
        // always fail thumbnails, so only images go in.
        body: JSON.stringify({
          entries: images.slice(0, 100).map((f) => ({
            path: f.path,
            format: 'jpeg',
            size: 'w256h256',
          })),
        }),
      });
      const tj: any = await tr.json().catch(() => ({}));
      if (!tr.ok) throw new Error(String(tj?.error_summary ?? tr.status));
      const byPath = new Map<string, string>();
      for (const t of ((tj?.entries ?? []) as any[])) {
        const p = String(t?.metadata?.path_lower ?? '');
        if (t?.['.tag'] === 'file' && typeof t?.thumbnail === 'string' && p) {
          byPath.set(p, t.thumbnail);
        }
      }
      for (const f of images) {
        const b64 = byPath.get(f.path);
        if (b64) f.thumb = `data:image/jpeg;base64,${b64}`;
      }
    } catch (e) {
      console.warn('[dropbox] thumbnail batch failed:', e instanceof Error ? e.message : e);
    }
  }
  return { folders, files };
}

/** Search images + videos by name across the whole Dropbox. */
export async function searchDropbox(query: string): Promise<DropboxEntry[]> {
  const token = await getValidDropboxToken();
  const r = await fetch(`${RPC_ENDPOINT}/files/search_v2`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query.trim(),
      options: { max_results: 50, file_categories: ['image', 'video'] },
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error_summary ?? `HTTP ${r.status}`;
    throw new Error(`Dropbox refused the search (${String(msg).slice(0, 100)}).`);
  }
  const out: DropboxEntry[] = [];
  for (const m of ((j?.matches ?? []) as any[])) {
    const md = m?.metadata?.metadata ?? m?.metadata;
    if (md?.['.tag'] !== 'file') continue;
    const kind = entryKind(String(md?.name ?? ''), md?.media_info?.['.tag']);
    if (kind) out.push({ kind, name: String(md?.name ?? 'File'), path: String(md?.path_lower ?? '') });
  }
  return out;
}

/** Dropbox file → sandbox file (Dropbox-API-Arg header on the download). */
export async function downloadDropboxFile(entry: DropboxEntry): Promise<{ uri: string; kind: 'image' | 'video' }> {
  if (entry.kind === 'folder') throw new Error('Pick a file, not a folder.');
  const token = await getValidDropboxToken();
  const ext = entry.kind === 'video' ? 'mp4' : 'jpg';
  const safe = entry.path.replace(/[^a-z0-9]+/gi, '_').slice(-40);
  const dest = `${FileSystem.documentDirectory}dropbox/${Date.now()}_${safe}.${ext}`;
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}dropbox/`, { intermediates: true });
  } catch {}
  const dl = await FileSystem.downloadAsync(`${CONTENT_ENDPOINT}/files/download`, dest, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: entry.path }),
    },
  });
  if (dl.status !== 200) throw new Error('Dropbox download failed — try another file.');
  return { uri: dl.uri, kind: entry.kind };
}
