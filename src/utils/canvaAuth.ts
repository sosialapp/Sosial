/**
 * Canva OAuth + browser (Connect APIs).
 * PKCE S256 is mandatory; the token swap runs through the cloud-exchange
 * edge fn (client secret stays server-side, never baked into the app).
 * Tokens live in SecureStore (device-only). Designs export on pick
 * (jpg photo or mp4 video) and flow through the normal pipeline after.
 */

import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { BRIDGE_URL, appReturnUrl } from './metaAuth';
import { callEdgeFunction } from './supabase';

const AUTH_ENDPOINT = 'https://www.canva.com/api/oauth/authorize';
/** Public identifier (appears in authorize URLs by design); the secret
 *  never leaves the cloud-exchange edge fn. */
const CLIENT_ID = 'OC-AaECdza1N_BQ';
const SCOPES = ['design:content:read', 'design:meta:read', 'asset:read', 'folder:read', 'profile:read'];
const API = 'https://api.canva.com/rest/v1';
const STORE_KEY = 'sosial_src_canva_v1';

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

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const rand = await Crypto.getRandomBytesAsync(48);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const verifier = Array.from(rand, (b) => alphabet[b % 64]).join('');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { verifier, challenge };
}

let pendingVerifier: string | null = null;

export async function canvaConnected(): Promise<boolean> {
  const t = await readStored();
  return !!t?.refreshToken;
}

/** Push tokens to the cloud so the connection follows the user's account. */
async function syncCloud(t: { accessToken: string; refreshToken: string; expiresAt: number }): Promise<void> {
  try {
    await callEdgeFunction('media-integration', {
      provider: 'canva',
      access_token: t.accessToken,
      refresh_token: t.refreshToken,
      expires_in: Math.max(60, Math.round((t.expiresAt - Date.now()) / 1000)),
    });
  } catch {}
}

/** Forget Canva tokens here + in the cloud. */
export async function disconnectCanva(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {}
  try {
    await callEdgeFunction('media-integration', { provider: 'canva', remove: true });
  } catch {}
}

/** System-browser consent; returns true when Canva redirected back. */
export async function loginCanva(): Promise<boolean> {
  const clientId = CLIENT_ID;
  const { verifier, challenge } = await pkcePair();
  pendingVerifier = verifier;
  const url =
    `${AUTH_ENDPOINT}?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(BRIDGE_URL)}` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=S256` +
    `&state=${encodeURIComponent(appReturnUrl())}`;
  try {
    await (WebBrowser as any).dismissBrowser?.();
  } catch {}
  try {
    const res = await WebBrowser.openAuthSessionAsync(url, appReturnUrl(), {
      preferEphemeralSession: false,
    });
    if (res.type !== 'success' || !('url' in res) || !res.url) return false;
    const urlStr = String(res.url);
    const errM = urlStr.match(/[?&#]error=([^&]+)/);
    if (errM?.[1]) {
      const descM = urlStr.match(/[?&#]error_description=([^&]+)/);
      const desc = descM?.[1] ? decodeURIComponent(descM[1].replace(/\+/g, ' ')) : decodeURIComponent(errM[1]);
      throw new Error(`Canva refused: ${desc.slice(0, 160)}`);
    }
    const m = urlStr.match(/[?&#]code=([^&]+)/);
    const code = m?.[1] ? decodeURIComponent(m[1]) : '';
    if (!code || !pendingVerifier) return false;
    await exchangeCanvaCode(code, pendingVerifier);
    pendingVerifier = null;
    return true;
  } catch {
    pendingVerifier = null;
    return false;
  } finally {
    pendingVerifier = null;
  }
}

function toTokens(j: any, fallbackRefresh: string): StoredTokens {
  if (!j?.access_token) {
    throw new Error(`Canva login failed. ${String(j?.error ?? j?.message ?? 'unknown error').slice(0, 120)}`);
  }
  return {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token ?? fallbackRefresh),
    expiresAt: Date.now() + Number(j.expires_in ?? 14400) * 1000,
  };
}

async function exchangeCanvaCode(code: string, verifier: string): Promise<StoredTokens> {
  const j: any = await callEdgeFunction('cloud-exchange', {
    provider: 'canva',
    code,
    redirect_uri: BRIDGE_URL,
    code_verifier: verifier,
  });
  const t = toTokens(j, '');
  if (!t.refreshToken) throw new Error('Canva did not return a lasting login — try again.');
  await writeStored(t);
  void syncCloud(t);
  return t;
}

/** Valid access token (refresh-first when stale). */
export async function getValidCanvaToken(): Promise<string> {
  const t = await readStored();
  if (t && t.expiresAt > Date.now() + 60000 && t.accessToken) return t.accessToken;
  if (!t?.refreshToken) {
    try {
      const j: any = await callEdgeFunction('media-integration', { provider: 'canva', status: true });
      if (j?.connected && j.access_token && j.refresh_token) {
        const restored: { accessToken: string; refreshToken: string; expiresAt: number } = {
          accessToken: String(j.access_token),
          refreshToken: String(j.refresh_token),
          expiresAt: Date.now() + 60_000,
        };
        await writeStored(restored);
        return restored.accessToken;
      }
    } catch {}
    throw new Error('Connect Canva first.');
  }
  const j: any = await callEdgeFunction('cloud-exchange', {
    provider: 'canva',
    refresh_token: t.refreshToken,
  });
  const next = toTokens(j, t.refreshToken);
  await writeStored(next);
  return next.accessToken;
}

export interface CanvaDesign {
  id: string;
  title: string;
  thumb?: string;
}

/** Designs (newest first), optionally matching a query. Note: Canva has no
 *  list-folders endpoint, so there is no folder navigation — designs only. */
export async function listCanvaDesigns(query?: string): Promise<{ designs: CanvaDesign[]; folders: { id: string; name: string }[] }> {
  const token = await getValidCanvaToken();
  const headers = { Authorization: `Bearer ${token}` };
  const q = (p: string) => `${API}${p}`;
  const params = new URLSearchParams({ limit: '50' });
  if (query?.trim()) params.set('query', query.trim());
  const r = await fetch(q(`/designs?${params}`), { headers });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message ?? `Canva refused the list (HTTP ${r.status}).`);
  const designs = (((j?.items ?? []) as any[])
    .map((x: any) => ({
      id: String(x?.id ?? ''),
      title: String(x?.title ?? 'Untitled design'),
      thumb: typeof x?.thumbnail?.url === 'string' ? x.thumbnail.url : undefined,
    }))
    .filter((d) => d.id));
  return { designs, folders: [] };
}

/** Export a design (jpg photo or mp4 video) → sandbox file. */
export async function downloadCanvaDesign(d: CanvaDesign, kind: 'image' | 'video'): Promise<{ uri: string; kind: 'image' | 'video' }> {
  const token = await getValidCanvaToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const start = await fetch(`${API}/exports`, {
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
    const pr = await fetch(`${API}/exports/${encodeURIComponent(jobId)}`, { headers });
    const pj: any = await pr.json().catch(() => ({}));
    if (!pr.ok) throw new Error(pj?.message ?? `Canva lost the export (HTTP ${pr.status}).`);
    const status = String(pj?.job?.status ?? '');
    if (status === 'success') {
      const url = String(pj?.job?.urls?.[0] ?? '');
      if (!url) throw new Error('Canva finished with no file.');
      const ext = kind === 'video' ? 'mp4' : 'jpg';
      const dest = `${FileSystem.documentDirectory}canva/${Date.now()}.${ext}`;
      try {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}canva/`, { intermediates: true });
      } catch {}
      const dl = await FileSystem.downloadAsync(url, dest);
      if (dl.status !== 200) throw new Error('Download failed — try another design.');
      return { uri: dl.uri, kind };
    }
    if (status === 'failed') {
      throw new Error(`Canva could not export that design (${String(pj?.job?.error?.message ?? 'unknown error').slice(0, 100)}).`);
    }
    if (Date.now() > deadline) throw new Error('Canva is taking too long — try again.');
  }
}
