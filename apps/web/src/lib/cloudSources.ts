'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Cloud media sources for the web composer (Drive / Photos / Dropbox).
 * Tokens live in sessionStorage (device-only — the DB never sees them);
 * code↔token swaps run through the cloud-exchange edge fn, which persists
 * nothing. Google Photos originals stream through cloud-fetch (its CDN host
 * sends no CORS headers); Drive + Dropbox download directly.
 */

export type CloudProvider = 'google' | 'dropbox';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
].join(' ');
const DROPBOX_SCOPES = 'files.metadata.read files.content.read';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const PHOTOS_API = 'https://photoslibrary.googleapis.com/v1';

interface Tokens {
  access: string;
  refresh: string;
  expiresAt: number;
}

const key = (p: CloudProvider) => `sosial_cloud_${p}`;

function readTokens(p: CloudProvider): Tokens | null {
  try {
    const raw = sessionStorage.getItem(key(p));
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<Tokens>;
    if (typeof j.access !== 'string') return null;
    return { access: j.access, refresh: typeof j.refresh === 'string' ? j.refresh : '', expiresAt: Number(j.expiresAt ?? 0) };
  } catch {
    return null;
  }
}

function writeTokens(p: CloudProvider, t: Tokens) {
  try {
    sessionStorage.setItem(key(p), JSON.stringify(t));
  } catch {}
}

export function cloudConnected(p: CloudProvider): boolean {
  return !!readTokens(p)?.access;
}

async function authedInvoke(fn: string, body: Record<string, unknown>) {
  const sb = await createClient();
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as any;
}

/** Popup consent via the shared bridge; resolves with fresh tokens. */
export async function loginCloud(provider: CloudProvider): Promise<boolean> {
  const sb = await createClient();
  const { data: config } = await sb.functions.invoke('oauth-config', { method: 'GET' });
  const clientId =
    provider === 'dropbox'
      ? String((config as any)?.dropbox?.client_id ?? '')
      : String((config as any)?.youtube?.client_id ?? (config as any)?.gmb?.client_id ?? '');
  if (!clientId) throw new Error('That source is not configured yet.');
  const redirectUri = `${location.origin}/auth.html`;
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const state = `cloud:${provider}:${nonce}`;
  const authUrl =
    provider === 'dropbox'
      ? `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          token_access_type: 'offline',
          scope: DROPBOX_SCOPES,
          state,
        })}`
      : `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: GOOGLE_SCOPES,
          access_type: 'offline',
          prompt: 'consent',
          state,
        })}`;

  const tokens = await new Promise<Tokens | null>((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const d = e.data as any;
      if (!d || d.type !== 'sosial-cloud' || d.nonce !== nonce) return;
      window.removeEventListener('message', onMsg);
      if (d.ok && d.access_token) {
        resolve({
          access: String(d.access_token),
          refresh: typeof d.refresh_token === 'string' ? d.refresh_token : '',
          expiresAt: Date.now() + Number(d.expires_in ?? 14400) * 1000,
        });
      } else {
        resolve(null);
      }
    };
    window.addEventListener('message', onMsg);
    const pop = window.open(authUrl, 'sosial-cloud', 'width=520,height=640');
    if (!pop) {
      window.removeEventListener('message', onMsg);
      resolve(null);
      return;
    }
    const timer = window.setInterval(() => {
      if (pop.closed) {
        window.clearInterval(timer);
        window.removeEventListener('message', onMsg);
        resolve(null);
      }
    }, 500);
    window.setTimeout(() => {
      window.clearInterval(timer);
      window.removeEventListener('message', onMsg);
      resolve(null);
    }, 5 * 60 * 1000);
  });
  if (!tokens) return false;
  writeTokens(provider, tokens);
  return true;
}

export async function getValidCloudToken(provider: CloudProvider): Promise<string> {
  const t = readTokens(provider);
  if (t && t.expiresAt > Date.now() + 60000 && t.access) return t.access;
  if (!t?.refresh) throw new Error('Connect that source first.');
  const j = await authedInvoke('cloud-exchange', { provider, refresh_token: t.refresh });
  const next: Tokens = {
    access: String(j.access_token),
    refresh: typeof j.refresh_token === 'string' && j.refresh_token ? j.refresh_token : t.refresh,
    expiresAt: Date.now() + Number(j.expires_in ?? 14400) * 1000,
  };
  writeTokens(provider, next);
  return next.access;
}

/* --------------------------------- Drive --------------------------------- */

export interface CloudDriveFile {
  id: string;
  name: string;
  kind: 'image' | 'video';
  thumb?: string;
  path?: string;
}

export async function listDriveFiles(folderId?: string, query?: string): Promise<{ files: CloudDriveFile[]; folders: { id: string; name: string }[] }> {
  const token = await getValidCloudToken('google');
  const auth = { Authorization: `Bearer ${token}` };
  const clauses = [
    'trashed = false',
    `(mimeType contains 'image/' or mimeType contains 'video/')`,
    folderId && folderId !== 'root' ? `'${folderId.replace(/'/g, '')}' in parents` : null,
    query?.trim() ? `name contains '${query.trim().replace(/'/g, '')}'` : null,
  ].filter(Boolean) as string[];
  const [filesRes, foldersRes] = await Promise.all([
    fetch(`${DRIVE_API}/files?${new URLSearchParams({ q: clauses.join(' and '), pageSize: '50', orderBy: 'modifiedTime desc', fields: 'files(id,name,mimeType,thumbnailLink)' })}`, { headers: auth }),
    query?.trim()
      ? null
      : fetch(
          `${DRIVE_API}/files?${new URLSearchParams({ q: `trashed = false and mimeType = 'application/vnd.google-apps.folder'${folderId && folderId !== 'root' ? ` and '${folderId.replace(/'/g, '')}' in parents` : ''}`, pageSize: '50', orderBy: 'name', fields: 'files(id,name)' })}`,
          { headers: auth },
        ),
  ]);
  const fj: any = await filesRes.json().catch(() => ({}));
  if (!filesRes.ok) throw new Error(fj?.error?.message ?? `Drive refused the list (HTTP ${filesRes.status}).`);
  const files: CloudDriveFile[] = ((fj?.files ?? []) as any[])
    .map((f: any) => ({
      id: String(f?.id ?? ''),
      name: String(f?.name ?? 'File'),
      kind: (String(f?.mimeType ?? '').startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
      thumb: typeof f?.thumbnailLink === 'string' ? f.thumbnailLink : undefined,
    }))
    .filter((f) => f.id);
  let folders: { id: string; name: string }[] = [];
  if (foldersRes) {
    const oj: any = await foldersRes.json().catch(() => ({}));
    if (foldersRes.ok) {
      folders = ((oj?.files ?? []) as any[])
        .map((f: any) => ({ id: String(f?.id ?? ''), name: String(f?.name ?? 'Folder') }))
        .filter((f) => f.id);
    }
  }
  return { files, folders };
}

export async function downloadDriveFile(f: CloudDriveFile): Promise<File> {
  const token = await getValidCloudToken('google');
  const r = await fetch(`${DRIVE_API}/files/${encodeURIComponent(f.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('Drive download failed — try another file.');
  const blob = await r.blob();
  return new File([blob], f.name || `drive-${f.id}.${f.kind === 'video' ? 'mp4' : 'jpg'}`, {
    type: f.kind === 'video' ? 'video/mp4' : 'image/jpeg',
  });
}

/* --------------------------------- Photos -------------------------------- */

export interface CloudPhoto {
  id: string;
  kind: 'image' | 'video';
  thumb: string;
  baseUrl: string;
}

export async function listGooglePhotos(query?: string): Promise<CloudPhoto[]> {
  const token = await getValidCloudToken('google');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let j: any;
  if (query?.trim()) {
    const r = await fetch(`${PHOTOS_API}/mediaItems:search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ q: query.trim(), pageSize: 50, filters: { mediaTypeFilter: { mediaTypes: ['ALL_MEDIA'] } } }),
    });
    j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message ?? `Photos refused the search (HTTP ${r.status}).`);
  } else {
    const r = await fetch(`${PHOTOS_API}/mediaItems?${new URLSearchParams({ pageSize: '50' })}`, { headers });
    j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message ?? `Photos refused the list (HTTP ${r.status}).`);
  }
  return ((j?.mediaItems ?? []) as any[])
    .map((m: any) => {
      const base = String(m?.baseUrl ?? '');
      return {
        id: String(m?.id ?? ''),
        kind: (m?.mediaMetadata?.video !== undefined ? 'video' : 'image') as 'image' | 'video',
        thumb: base ? `${base}=w256-h256-c` : '',
        baseUrl: base,
      };
    })
    .filter((x) => x.id && x.baseUrl);
}

export async function downloadGooglePhoto(p: CloudPhoto): Promise<File> {
  // googleusercontent sends no CORS headers — stream the bytes through
  // cloud-fetch (persisted nowhere), then wrap as a File for the composer.
  const sb = await createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in first.');
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const r = await fetch(`${base}/functions/v1/cloud-fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ url: `${p.baseUrl}=d` }),
  });
  if (!r.ok) throw new Error('Photos download failed — try another one.');
  const blob = await r.blob();
  return new File([blob], `photos-${p.id}.${p.kind === 'video' ? 'mp4' : 'jpg'}`, {
    type: blob.type.startsWith('video/') ? blob.type : p.kind === 'video' ? 'video/mp4' : 'image/jpeg',
  });
}

/* -------------------------------- Dropbox -------------------------------- */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i;

export interface CloudDropboxEntry {
  kind: 'image' | 'video' | 'folder';
  name: string;
  path: string;
  thumb?: string;
}

function dbxKind(name: string, mediaTag?: string): 'image' | 'video' | null {
  if (mediaTag === 'photo') return 'image';
  if (mediaTag === 'video') return 'video';
  if (IMAGE_EXT.test(name)) return 'image';
  if (VIDEO_EXT.test(name)) return 'video';
  return null;
}

export async function listDropboxFolder(path?: string): Promise<{ folders: CloudDropboxEntry[]; files: CloudDropboxEntry[] }> {
  const token = await getValidCloudToken('dropbox');
  const r = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: path && path.length ? path : '', recursive: false, limit: 500, include_media_info: true }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Dropbox refused the list (${String(j?.error_summary ?? `HTTP ${r.status}`).slice(0, 100)}).`);
  const folders: CloudDropboxEntry[] = [];
  const files: CloudDropboxEntry[] = [];
  for (const e of ((j?.entries ?? []) as any[])) {
    if (e?.['.tag'] === 'folder') {
      folders.push({ kind: 'folder', name: String(e?.name ?? 'Folder'), path: String(e?.path_lower ?? '') });
    } else if (e?.['.tag'] === 'file') {
      const kind = dbxKind(String(e?.name ?? ''), e?.media_info?.['.tag']);
      if (kind) files.push({ kind, name: String(e?.name ?? 'File'), path: String(e?.path_lower ?? '') });
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  const images = files.filter((f) => f.kind === 'image');
  if (images.length) {
    try {
      const tr = await fetch('https://api.dropboxapi.com/2/files/get_thumbnail_batch', {
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

export async function searchDropbox(query: string): Promise<CloudDropboxEntry[]> {
  const token = await getValidCloudToken('dropbox');
  const r = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query.trim(), options: { max_results: 50, file_categories: ['image', 'video'] } }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Dropbox refused the search (${String(j?.error_summary ?? `HTTP ${r.status}`).slice(0, 100)}).`);
  const out: CloudDropboxEntry[] = [];
  for (const m of ((j?.matches ?? []) as any[])) {
    const md = m?.metadata?.metadata ?? m?.metadata;
    if (md?.['.tag'] !== 'file') continue;
    const kind = dbxKind(String(md?.name ?? ''), md?.media_info?.['.tag']);
    if (kind) out.push({ kind, name: String(md?.name ?? 'File'), path: String(md?.path_lower ?? '') });
  }
  return out;
}

export async function downloadDropboxFile(e: CloudDropboxEntry): Promise<File> {
  const token = await getValidCloudToken('dropbox');
  const r = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: e.path }) },
  });
  if (!r.ok) throw new Error('Dropbox download failed — try another file.');
  const blob = await r.blob();
  return new File([blob], e.name || `dropbox.${e.kind === 'video' ? 'mp4' : 'jpg'}`, {
    type: e.kind === 'video' ? 'video/mp4' : 'image/jpeg',
  });
}
