import { readSecret, updateSecret } from './db';
import { info } from './logger';
import { env } from './env';

/**
 * Google Business Profile publisher (local posts, per-location rows).
 *
 * Same Google OAuth client as YouTube (YT_CLIENT_ID/SECRET or
 * GOOGLE_CLIENT_ID/SECRET); the connect flow requests the extra
 * business.manage scope, so one consent covers both. Tokens live in Vault.
 * - Locations: GET mybusinessaccounts.googleapis.com/v1/accounts →
 *   /{account}/locations (connect-time picker)
 * - Publish: POST .../locations/{l}/localPosts
 *   {languageCode, summary, topicType:STANDARD}
 *
 * v1 is STANDARD text posts only: offers/events need structured payloads,
 * CTAs need composer fields, media needs the media.startUpload dance — all
 * declared in compat. Google gates the whole API behind a one-time project
 * allow-list; errors surface verbatim so an un-allowed project is obvious.
 */

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const API_BI = 'https://mybusinessbusinessinformation.googleapis.com/v1';
// Local posts live on the v4 Google My Business API, NOT the Business
// Information host — posting there 404s. Separate console entry below.
const API_POSTS = 'https://mybusiness.googleapis.com/v4';

function clientCreds(): { id: string; secret: string } {
  const id = env('YT_CLIENT_ID') || env('GOOGLE_CLIENT_ID');
  const secret = env('YT_CLIENT_SECRET') || env('GOOGLE_CLIENT_SECRET');
  if (!id || !secret) {
    throw new Error('Google Business Profile publishing needs YT_CLIENT_ID + YT_CLIENT_SECRET (or GOOGLE_*) on the worker.');
  }
  return { id, secret };
}

function gerr(j: any, fallback: string): string {
  const m = j?.error?.message ?? j?.error ?? j?.message;
  const base = typeof m === 'string' && m ? m : fallback;
  if (/PERMISSION_DENIED|has not been used|is disabled/i.test(base)) {
    return `${base} — the Google Cloud project needs Business Profile API access approved (one-time allow-list) before this works.`;
  }
  if (/UNAUTHENTICATED|invalid_grant/i.test(base)) {
    return 'Google session expired — reconnect Google Business Profile in Connect.';
  }
  return base;
}

/** Valid access token, refreshing 10 min before expiry (Vault-backed). */
export async function ensureToken(b: Bundle, force = false): Promise<string> {
  const fresh =
    !force && b.secrets.expires_at && Date.parse(b.secrets.expires_at) > Date.now() + 600000;
  if (fresh && b.secrets.access_secret_id) {
    const access = await readSecret(b.secrets.access_secret_id);
    if (access) return access;
  }
  if (!b.secrets.refresh_secret_id) {
    throw new Error('Google session expired — reconnect Google Business Profile in Connect.');
  }
  const refresh = await readSecret(b.secrets.refresh_secret_id);
  if (!refresh) throw new Error('Google session expired — reconnect Google Business Profile in Connect.');
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: id,
    client_secret: secret,
  });
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token) {
    const msg = String(j?.error_description || j?.error || 'Google session expired');
    throw new Error(`${msg} — reconnect Google Business Profile in Connect.`);
  }
  const newAccess = String(j.access_token);
  const newRefresh = String(j.refresh_token || refresh);
  if (b.secrets.access_secret_id) await updateSecret(b.secrets.access_secret_id, newAccess);
  // Google only returns a refresh token on first consent — keep the old one.
  await updateSecret(b.secrets.refresh_secret_id, newRefresh);
  const { required } = await import('./env');
  const base = required('WORKER_SUPABASE_URL').replace(/\/+$/, '');
  const k = required('WORKER_SERVICE_ROLE_KEY');
  await fetch(`${base}/rest/v1/channel_tokens?channel_id=eq.${encodeURIComponent(b.channel.id)}`, {
    method: 'PATCH',
    headers: { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      expires_at: new Date(Date.now() + Number(j.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  return newAccess;
}

async function api<T>(access: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as any;
  if (res.status === 401) throw new Error('__EXPIRED__');
  if (!res.ok || json === null) throw new Error(gerr(json, `Google Business Profile refused the request (HTTP ${res.status}).`));
  return json as T;
}

function locationName(externalId: string): string {
  const v = String(externalId ?? '');
  if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(v)) {
    throw new Error('Google Business Profile location is missing — reconnect the channel in Connect.');
  }
  return v;
}

export async function publishGmbTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  const parent = locationName(b.channel.external_id);
  let access: string;
  try {
    access = await ensureToken(b);
  } catch (e) {
    throw e;
  }

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  if (!text) throw new Error('Google Business Profile needs post text — this post is empty.');
  // Local post summary caps at 1500 chars; the first body line reads as the
  // headline but GBP has no separate title field.
  const summary = text.slice(0, 1500);

  const form = {
    languageCode: 'en',
    summary,
    topicType: 'STANDARD',
  };
  let data: { name?: string; searchUrl?: string };
  try {
    data = await api<typeof data>(
      access,
      `${API_POSTS}/${parent}/localPosts`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) },
    );
  } catch (e: any) {
    if (e?.message !== '__EXPIRED__') throw e;
    access = await ensureToken(b, true);
    data = await api<typeof data>(
      access,
      `${API_POSTS}/${parent}/localPosts`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) },
    );
  }
  if (!data?.name) throw new Error('Google accepted the post but returned no id — check the profile before retrying.');
  info('gmb local post published', { target: b.target.id, post: data.name });
  // searchUrl (the public link) rides back on creation when present.
  return { remoteId: data.name, remoteUrl: (data as any).searchUrl ?? `https://business.google.com/` };
}

/** Connect-time: every location across the account's accessible profiles. */
export async function gmbLocations(access: string): Promise<{ name: string; title: string; storeCode?: string }[]> {
  const out: { name: string; title: string; storeCode?: string }[] = [];
  const accounts = await api<{ accounts?: { name: string; accountName?: string }[] }>(access, `${API}/accounts`);
  for (const a of accounts?.accounts ?? []) {
    try {
      const locs = await api<{
        locations?: { name: string; title?: string; storeCode?: string }[];
      }>(
        access,
        `${API_BI}/${a.name}/locations?pageSize=100&readMask=name,title,storeCode`,
      );
      for (const l of locs?.locations ?? []) {
        out.push({ name: l.name, title: l.title || a.accountName || l.name, storeCode: l.storeCode });
      }
    } catch {
      /* account without Business Profile access — skip silently */
    }
  }
  return out;
}

/** Connect-time validation: proves the token lists at least one account. */
export async function gmbValidate(access: string): Promise<{ email?: string }> {
  const me = await api<{ email?: string }>(access, `${API}/accounts`);
  if (!me) throw new Error('Could not read your Google Business accounts.');
  return { email: (me as any).accounts?.[0]?.accountName };
}
