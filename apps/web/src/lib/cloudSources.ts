'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Cloud media sources for the web composer (Drive / Photos / Dropbox).
 * Tokens live in localStorage (this browser only — the DB never sees them);
 * code↔token swaps run through the cloud-exchange edge fn, which persists
 * nothing. Google Photos originals stream through cloud-fetch (its CDN host
 * sends no CORS headers); Drive + Dropbox download directly.
 */

export type CloudProvider = 'google' | 'dropbox' | 'canva' | 'onedrive';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
].join(' ');

/**
 * Google media (Drive + Photos Picker) is pending Google OAuth verification:
 * the restricted scopes above cannot be granted to production traffic until
 * the CASA assessment completes. UI gates the tiles behind "Soon"; this guard
 * backs it up so no code path can request the unverified scopes. Flip to
 * false (one line) once verification lands.
 */
export const GOOGLE_MEDIA_DISABLED = true;
const DROPBOX_SCOPES = 'files.metadata.read files.content.read';
const CANVA_SCOPES = ['design:content:read', 'design:meta:read', 'asset:read', 'profile:read'].join(' ');
const ONEDRIVE_SCOPES = 'offline_access Files.Read.All User.Read';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

interface Tokens {
  access: string;
  refresh: string;
  expiresAt: number;
}

const key = (p: CloudProvider) =>
  // v3: Photos moved Library API → Picker API, so every stored Google token
  // predates the new scope and must be re-consented. One-time forced logout.
  p === 'google' ? 'sosial_cloud_google_v3' : `sosial_cloud_${p}`;

function readTokens(p: CloudProvider): Tokens | null {
  try {
    const raw = localStorage.getItem(key(p));
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
    localStorage.setItem(key(p), JSON.stringify(t));
  } catch {}
}

export function cloudConnected(p: CloudProvider): boolean {
  return !!readTokens(p)?.access;
}

/** Forget a source's tokens in this browser (files untouched). */
export function disconnectCloud(p: CloudProvider): void {
  try {
    localStorage.removeItem(key(p));
  } catch {}
}

/**
 * Fetch → Blob with download progress (0–100). When the server hides the
 * total, onProgress stays silent and callers show an indeterminate spinner.
 */
export async function fetchProgressBlob(
  url: string,
  init: RequestInit,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const r = await fetch(url, init);
  if (!r.ok || !r.body) throw new Error(`Download failed (HTTP ${r.status}).`);
  const total = Number(r.headers.get('content-length') ?? 0);
  if (!total || !onProgress) return r.blob();
  const reader = r.body.getReader();
  const chunks: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(99, Math.round((got / total) * 100)));
  }
  onProgress(100);
  return new Blob(chunks);
}

async function authedInvoke(fn: string, body: Record<string, unknown>) {  const sb = await createClient();
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as any;
}

/**
 * Stock-function invoke that throws the server's own error text instead of
 * supabase-js's generic "non-2xx" wrapper — otherwise every stock failure
 * looks identical and nobody can tell rate-limit from misconfiguration.
 */
export async function invokeStock(fn: string, body: Record<string, unknown>): Promise<any> {
  const sb = await createClient();
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (!error) {
    if ((data as any)?.error) throw new Error(String((data as any).error));
    return data as any;
  }
  let msg: string | null = null;
  try {
    const ctx: any = (error as any)?.context;
    const res =
      ctx && typeof ctx.json === 'function'
        ? await (typeof ctx.clone === 'function' ? ctx.clone() : ctx).json().catch(() => null)
        : ctx;
    if (res && typeof res.error === 'string' && res.error) msg = res.error;
  } catch {}
  throw new Error(msg ?? error.message);
}

/** PKCE pair (WebCrypto S256) for Canva. */
async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = Array.from(bytes, (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[b % 64]).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge };
}

/** Popup consent via the shared bridge; resolves with fresh tokens. */
export async function loginCloud(provider: CloudProvider): Promise<boolean> {
  if (GOOGLE_MEDIA_DISABLED && provider === 'google') {
    throw new Error('Google Drive and Photos are coming soon — pending Google verification.');
  }
  const sb = await createClient();
  const { data: config } = await sb.functions.invoke('oauth-config', { method: 'GET' });
  const clientId =
    provider === 'dropbox'
      ? String((config as any)?.dropbox?.client_id ?? '')
      : provider === 'canva'
        ? String((config as any)?.canva?.client_id ?? '')
        : provider === 'onedrive'
          ? String((config as any)?.onedrive?.client_id ?? '')
          : String((config as any)?.youtube?.client_id ?? (config as any)?.gmb?.client_id ?? '');
  if (!clientId) throw new Error('That source is not configured yet.');
  const redirectUri = `${location.origin}/auth.html`;
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const state = `cloud:${provider}:${nonce}`;
  const pkce = provider === 'canva' ? await pkcePair() : null;
  let providerError: string | null = null;  const authUrl =
    provider === 'dropbox'
      ? `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          token_access_type: 'offline',
          scope: DROPBOX_SCOPES,
          state,
        })}`
      : provider === 'canva'
        ? `https://www.canva.com/api/oauth/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: CANVA_SCOPES,
            code_challenge: pkce!.challenge,
            code_challenge_method: 'S256',
            state,
          })}`
        : provider === 'onedrive'
          ? `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${new URLSearchParams({
              response_type: 'code',
              client_id: clientId,
              redirect_uri: redirectUri,
              scope: ONEDRIVE_SCOPES,
              response_mode: 'query',
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
    let settled = false;
    const finish = async (d: any) => {
      if (settled) return;
      settled = true;
      try {
        window.removeEventListener('message', onMsg);
      } catch {}
      try {
        bc?.close();
      } catch {}
      if (!d?.ok) {
        // Provider refusals (bad redirect URI, scope, etc.) carry the real
        // reason — stash it so the caller throws it instead of "cancelled".
        providerError = typeof d?.error === 'string' && d.error ? d.error : null;
        resolve(null);
        return;
      }
      try {
        if (d.access_token) {
          resolve({
            access: String(d.access_token),
            refresh: typeof d.refresh_token === 'string' ? d.refresh_token : '',
            expiresAt: Date.now() + Number(d.expires_in ?? 14400) * 1000,
          });
        } else if (d.code && provider === 'canva' && pkce) {
          // Canva hands back the code; the verifier never left this tab, so
          // finish the exchange here via cloud-exchange (secret stays server-side).
          const j = await authedInvoke('cloud-exchange', {
            provider: 'canva',
            code: String(d.code),
            redirect_uri: redirectUri,
            code_verifier: pkce.verifier,
          });
          if (!j.access_token) throw new Error('Canva hid the login — try again.');
          resolve({
            access: String(j.access_token),
            refresh: typeof j.refresh_token === 'string' ? j.refresh_token : '',
            expiresAt: Date.now() + Number(j.expires_in ?? 14400) * 1000,
          });
        } else if (d.code && provider === 'onedrive') {
          // Microsoft: same shape as Canva — the client secret stays in the
          // edge fn; this tab only relays the code.
          const j = await authedInvoke('cloud-exchange', {
            provider: 'onedrive',
            code: String(d.code),
            redirect_uri: redirectUri,
          });
          if (!j.access_token) throw new Error('Microsoft hid the login — try again.');
          resolve({
            access: String(j.access_token),
            refresh: typeof j.refresh_token === 'string' ? j.refresh_token : '',
            expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const d = e.data as any;
      if (!d || d.type !== 'sosial-cloud' || d.nonce !== nonce) return;
      void finish(d);
    };
    window.addEventListener('message', onMsg);
    // Same-origin broadcast fallback — works even when the provider severs
    // window.opener on the way back (Canva's COOP headers do exactly that).
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('sosial-cloud');
      bc.onmessage = (e: MessageEvent) => {
        const d = e.data as any;
        if (!d || d.type !== 'sosial-cloud' || d.nonce !== nonce) return;
        void finish(d);
      };
    } catch {
      bc = null;
    }
    const pop = window.open(authUrl, 'sosial-cloud', 'width=520,height=640');
    if (!pop) {
      window.removeEventListener('message', onMsg);
      try {
        bc?.close();
      } catch {}
      resolve(null);
      return;
    }
    const timer = window.setInterval(() => {
      try {
        // Cross-origin popups (Google/Dropbox/Canva) make Chrome log a COOP
        // warning on .closed access — harmless; the postMessage handshake
        // below is what actually settles the flow.
        if (pop.closed) {
          window.clearInterval(timer);
          window.removeEventListener('message', onMsg);
          try {
            bc?.close();
          } catch {}
          resolve(null);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 2000);
    window.setTimeout(() => {
      window.clearInterval(timer);
      window.removeEventListener('message', onMsg);
      try {
        bc?.close();
      } catch {}
      resolve(null);
    }, 5 * 60 * 1000);
  });
  if (!tokens) {
    if (providerError) throw new Error(providerError);
    return false;
  }
  writeTokens(provider, tokens);
  // Cloud sync: the connection follows the user across devices/browsers.
  try {
    await authedInvoke('media-integration', {
      provider,
      access_token: tokens.access,
      refresh_token: tokens.refresh,
      expires_in: Math.max(60, Math.round((tokens.expiresAt - Date.now()) / 1000)),
    });
  } catch {
    /* local session still works; sync retries on next connect/refresh */
  }
  return true;
}

/** Pull the cloud connection for this user into local storage (fallback when
 *  this browser has no local token). Returns true when connected. */
export async function ensureCloudSynced(provider: CloudProvider): Promise<boolean> {
  if (cloudConnected(provider)) return true;
  const sb = await createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) return false;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const r = await fetch(`${base}/functions/v1/media-integration?provider=${provider}`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', Authorization: `Bearer ${session.access_token}` },
  }).catch(() => null);
  if (!r?.ok) return false;
  const j: any = await r.json().catch(() => ({}));
  if (!j?.connected) return false;
  writeTokens(provider, {
    access: String(j.access_token),
    refresh: String(j.refresh_token),
    expiresAt: Date.now() + 60_000, // unknown server expiry — refresh-first
  });
  return true;
}

/** Forget everywhere: local cache + the cloud row. */
export async function disconnectCloudEverywhere(provider: CloudProvider): Promise<void> {
  disconnectCloud(provider);
  try {
    const sb = await createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) return;
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    await fetch(`${base}/functions/v1/media-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ provider, remove: true }),
    });
  } catch {}
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
  // No folder context → search the WHOLE Drive (all folders), newest first;
  // media-only, which is all the composer cares about.
  const clauses = [
    'trashed = false',
    `(mimeType contains 'image/' or mimeType contains 'video/')`,
    !folderId || folderId === 'root'
      ? `'me' in owners`
      : `'${folderId.replace(/'/g, '')}' in parents`,
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

export async function downloadDriveFile(f: CloudDriveFile, onProgress?: (pct: number) => void): Promise<File> {
  const token = await getValidCloudToken('google');
  const blob = await fetchProgressBlob(
    `${DRIVE_API}/files/${encodeURIComponent(f.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
    onProgress,
  ).catch(() => null);
  if (!blob) throw new Error('Drive download failed — try another file.');
  return new File([blob], f.name || `drive-${f.id}.${f.kind === 'video' ? 'mp4' : 'jpg'}`, {
    type: f.kind === 'video' ? 'video/mp4' : 'image/jpeg',
  });
}

/* --------------------------- Photos (Picker API) --------------------------- */
// The Library API no longer lists a user's library (Google removed those
// scopes April 2025) — selection goes through the Picker API instead: create
// a session, the user picks in Google's UI, then we read back only what was
// picked. Scope: photospicker.mediaitems.readonly (non-sensitive by design).

const PICKER_API = 'https://photospicker.googleapis.com/v1';

export interface CloudPhoto {
  id: string;
  kind: 'image' | 'video';
  thumb: string;
  baseUrl: string;
  name: string;
}

export interface PhotosPickerSession {
  id: string;
  pickerUri: string;
}

async function pickerAuthed(path: string, init?: RequestInit): Promise<any> {
  const token = await getValidCloudToken('google');
  const r = await fetch(`${PICKER_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `Photos picker refused (HTTP ${r.status}).`);
  return j;
}

/** New picking session → open pickerUri for the user. */
export async function createPhotosSession(): Promise<PhotosPickerSession> {
  const j = await pickerAuthed('/sessions', { method: 'POST', body: '{}' });
  const id = String(j?.id ?? '');
  const pickerUri = String(j?.pickerUri ?? '');
  if (!id || !pickerUri) throw new Error('Photos picker did not start — try again.');
  return { id, pickerUri };
}

/** True once the user finished picking in the Google UI. */
export async function photosSessionDone(sessionId: string): Promise<boolean> {
  const j = await pickerAuthed(`/sessions/${encodeURIComponent(sessionId)}`);
  return j?.mediaItemsSet === true;
}

/** Media the user picked in a finished session. */
export async function listPickedPhotos(sessionId: string): Promise<CloudPhoto[]> {
  const out: CloudPhoto[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 4; page++) {
    const params = new URLSearchParams({ sessionId, pageSize: '50' });
    if (pageToken) params.set('pageToken', pageToken);
    const j = await pickerAuthed(`/mediaItems?${params}`);
    for (const m of ((j?.mediaItems ?? []) as any[])) {
      const base = String(m?.mediaFile?.baseUrl ?? '');
      if (!String(m?.id ?? '') || !base) continue;
      const mime = String(m?.mimeType ?? '');
      const kind = (mime.startsWith('video/') || String(m?.type ?? '') === 'video' ? 'video' : 'image') as 'image' | 'video';
      out.push({
        id: String(m.id),
        kind,
        // Picker baseUrls are pre-signed: use byte-for-byte, no =w/=d suffixes.
        thumb: base,
        baseUrl: base,
        name: String(m?.filename ?? 'Photo'),
      });
    }
    pageToken = typeof j?.nextPageToken === 'string' ? j.nextPageToken : undefined;
    if (!pageToken) break;
  }
  return out;
}

/** Picked original → File. Picker /ppa/ URLs validate the requester, so the
 *  download goes through cloud-fetch WITH the user's Google token attached;
 *  if the plain URL refuses, retry once with the =d (original bytes) form. */
export async function downloadPickedPhoto(p: CloudPhoto): Promise<File> {
  const sb = await createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in first.');
  const googleToken = await getValidCloudToken('google');
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const call = async (url: string): Promise<Response> =>
    fetch(`${base}/functions/v1/cloud-fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ url, bearer: googleToken }),
    });
  let r = await call(p.baseUrl);
  if (!r.ok && !p.baseUrl.endsWith('=d')) {
    r = await call(`${p.baseUrl}=d`);
  }
  if (!r.ok) {
    const j: any = await r.json().catch(() => ({}));
    throw new Error(String(j?.error ?? 'Photos download failed — try again.'));
  }
  const blob = await r.blob();
  return new File([blob], p.name.includes('.') ? p.name : `photos-${p.id}.${p.kind === 'video' ? 'mp4' : 'jpg'}`, {
    type: blob.type.startsWith('video/') ? blob.type : p.kind === 'video' ? 'video/mp4' : 'image/jpeg',
  });
}

/** Fetch once through cloud-fetch and hand back a local object URL for
 *  previews — Picker thumbnails 403 when the browser loads them directly. */
export async function pickerThumbUrl(p: CloudPhoto): Promise<string> {
  const file = await downloadPickedPhoto(p);
  return URL.createObjectURL(file);
}

/* --------------------------------- Canva --------------------------------- */

const CANVA_API = 'https://api.canva.com/rest/v1';

export interface CloudCanvaDesign {
  id: string;
  title: string;
  thumb?: string;
}

async function canvaGet(path: string): Promise<any> {
  const token = await getValidCloudToken('canva');
  const r = await fetch(`${CANVA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message ?? `Canva refused (HTTP ${r.status}).`);
  return j;
}

/** Designs (newest first), optionally matching a query. Note: Canva has no
 *  list-folders endpoint, so there is no folder navigation — designs only. */
export async function listCanvaDesigns(query?: string): Promise<{ designs: CloudCanvaDesign[]; folders: { id: string; name: string }[] }> {
  const params = new URLSearchParams({ limit: '50' });
  if (query?.trim()) params.set('query', query.trim());
  const j = await canvaGet(`/designs?${params}`);
  const designs = (((j?.items ?? []) as any[])
    .map((x: any) => ({
      id: String(x?.id ?? ''),
      title: String(x?.title ?? 'Untitled design'),
      thumb: typeof x?.thumbnail?.url === 'string' ? x.thumbnail.url : undefined,
    }))
    .filter((d) => d.id));
  return { designs, folders: [] };
}

/** Export a design (jpg photo or mp4 video) and resolve it to a File. */
export async function downloadCanvaDesign(d: CloudCanvaDesign, kind: 'image' | 'video', onProgress?: (pct: number) => void): Promise<File> {
  const token = await getValidCloudToken('canva');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const start = await fetch(`${CANVA_API}/exports`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ design_id: d.id, format: kind === 'video' ? { type: 'mp4' } : { type: 'jpg', quality: 100 } }),
  });
  const sj: any = await start.json().catch(() => ({}));
  if (!start.ok) throw new Error(sj?.message ?? `Canva refused the export (HTTP ${start.status}).`);
  const jobId = String(sj?.job?.id ?? '');
  if (!jobId) throw new Error('Canva did not start the export.');
  const deadline = Date.now() + 90000;
  for (;;) {
    await new Promise((r) => setTimeout(r, 2500));
    const pr = await fetch(`${CANVA_API}/exports/${encodeURIComponent(jobId)}`, { headers });
    const pj: any = await pr.json().catch(() => ({}));
    if (!pr.ok) throw new Error(pj?.message ?? `Canva lost the export (HTTP ${pr.status}).`);
    const status = String(pj?.job?.status ?? '');
    if (status === 'success') {
      const url = String(pj?.job?.urls?.[0] ?? '');
      if (!url) throw new Error('Canva finished with no file.');
      const blob = await fetchProgressBlob(url, {}, onProgress).catch(() => null);
      if (!blob) throw new Error('Download failed — try another design.');
      return new File([blob], `canva-${d.id}.${kind === 'video' ? 'mp4' : 'jpg'}`, {
        type: kind === 'video' ? 'video/mp4' : 'image/jpeg',
      });
    }
    if (status === 'failed') throw new Error(`Canva could not export that design (${String(pj?.job?.error?.message ?? 'unknown error').slice(0, 100)}).`);
    if (Date.now() > deadline) throw new Error('Canva is taking too long — try again.');
  }
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

export async function downloadDropboxFile(e: CloudDropboxEntry, onProgress?: (pct: number) => void): Promise<File> {
  const token = await getValidCloudToken('dropbox');
  const blob = await fetchProgressBlob(
    'https://content.dropboxapi.com/2/files/download',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: e.path }) },
    },
    onProgress,
  ).catch(() => null);
  if (!blob) throw new Error('Dropbox download failed — try another file.');
  return new File([blob], e.name || `dropbox.${e.kind === 'video' ? 'mp4' : 'jpg'}`, {
    type: e.kind === 'video' ? 'video/mp4' : 'image/jpeg',
  });
}
/* -------------------------------- OneDrive -------------------------------- */

export interface CloudOneDriveItem {
  id: string;
  name: string;
  kind: 'image' | 'video';
  thumb?: string;
  parent?: string;
}

const OD_MEDIA = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'mp4', 'mov', 'webm', 'm4v'];

function odKind(name: string): 'image' | 'video' | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video';
  if (OD_MEDIA.includes(ext)) return 'image';
  return null;
}

interface OdItem {
  id: string;
  name: string;
  folder?: unknown;
  file?: unknown;
  image?: unknown;
  video?: unknown;
  parentReference?: { id?: string };
  '@microsoft.graph.downloadUrl'?: string;
  thumbnails?: { small?: { url?: string } };
}

function toOdItem(it: OdItem): CloudOneDriveItem | null {
  const kind = odKind(String(it.name ?? ''));
  if (!kind || it.folder) return null;
  const thumb = (it as any)?.thumbnails?.small?.url;
  return {
    id: String(it.id),
    name: String(it.name ?? 'file'),
    kind,
    ...(thumb ? { thumb: String(thumb) } : {}),
    ...(it.parentReference?.id ? { parent: String(it.parentReference.id) } : {}),
  };
}

/** Browse OneDrive: a folder's children, or a whole-drive media search. */
export async function listOneDriveFiles(
  folderId?: string,
  query?: string,
): Promise<{ files: CloudOneDriveItem[]; folders: { id: string; name: string }[] }> {
  const token = await getValidCloudToken('onedrive');
  const auth = { Authorization: `Bearer ${token}` };

  if (query && query.trim()) {
    // Graph search across the drive; media types only.
    const q = encodeURIComponent(`${query.trim().replace(/"/g, '')}`);
    const res = await fetch(`${GRAPH_API}/me/drive/root/search(q='${q}')?$top=50`, { headers: auth, signal: AbortSignal.timeout(20000) });
    if (res.status === 401) throw new Error('OneDrive session expired — reconnect the source.');
    if (!res.ok) throw new Error('OneDrive search failed — try again.');
    const j: any = await res.json().catch(() => ({}));
    const items: CloudOneDriveItem[] = [];
    const folders: { id: string; name: string }[] = [];
    for (const it of (j?.value ?? []) as OdItem[]) {
      if (it.folder) {
        folders.push({ id: String(it.id), name: String(it.name ?? 'Folder') });
        continue;
      }
      const mapped = toOdItem(it);
      if (mapped) items.push(mapped);
    }
    return { files: items, folders };
  }

  const path = folderId ? `/me/drive/items/${folderId}/children` : '/me/drive/root/children';
  const res = await fetch(`${path}?$top=100`, { headers: auth, signal: AbortSignal.timeout(20000) });
  if (res.status === 401) throw new Error('OneDrive session expired — reconnect the source.');
  if (!res.ok) throw new Error('OneDrive browse failed — try again.');
  const j: any = await res.json().catch(() => ({}));
  const items: CloudOneDriveItem[] = [];
  const folders: { id: string; name: string }[] = [];
  for (const it of (j?.value ?? []) as OdItem[]) {
    if (it.folder) {
      folders.push({ id: String(it.id), name: String(it.name ?? 'Folder') });
      continue;
    }
    const mapped = toOdItem(it);
    if (mapped) items.push(mapped);
  }
  // Media-first ordering, mirroring the Drive browser.
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { files: items, folders };
}

/** Download one OneDrive item as a composer-ready File. */
export async function downloadOneDriveFile(
  item: CloudOneDriveItem,
  onProgress?: (pct: number) => void,
): Promise<File> {
  const token = await getValidCloudToken('onedrive');
  // @microsoft.graph.downloadUrl (pre-authed) is included when we ask for it;
  // falling back to the plain content endpoint when absent.
  const metaRes = await fetch(`${GRAPH_API}/me/drive/items/${item.id}?select=@microsoft.graph.downloadUrl,name`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  let url = `${GRAPH_API}/me/drive/items/${item.id}/content`;
  if (metaRes.ok) {
    const j: any = await metaRes.json().catch(() => ({}));
    if (j?.['@microsoft.graph.downloadUrl']) url = String(j['@microsoft.graph.downloadUrl']);
  }
  const blob = await fetchProgressBlob(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    onProgress,
  ).catch(() => null);
  if (!blob) throw new Error('OneDrive download failed — try another file.');
  return new File([blob], item.name || `onedrive.${item.kind === 'video' ? 'mp4' : 'jpg'}`, {
    type: item.kind === 'video' ? 'video/mp4' : 'image/jpeg',
  });
}