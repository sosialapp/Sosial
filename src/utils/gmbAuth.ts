/**
 * Google Business Profile OAuth (same Google client as YouTube — one consent
 * covers both, business.manage added on top). Tokens persist per-account;
 * each Business Profile location becomes its own channel row.
 */

import { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_AUTH_ENDPOINT, YT_TOKEN_ENDPOINT } from './ytConfig';
import { API_ACCOUNTS, API_BI } from './gmbConfig';
import { BRIDGE_URL, appReturnUrl, openAuth } from './metaAuth';
import { loadProviderFields, saveProviderFields } from './metaStore';

const GMB_SCOPES = ['https://www.googleapis.com/auth/business.manage'];

/* ---------------- Login (same bridge page as YouTube) ---------------- */

export async function loginGmb(accountId?: string): Promise<boolean> {
  const url =
    `${YT_AUTH_ENDPOINT}?response_type=code` +
    `&client_id=${encodeURIComponent(YT_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(BRIDGE_URL)}` +
    `&scope=${encodeURIComponent(GMB_SCOPES.join(' '))}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(appReturnUrl())}`;
  return openAuth(url, 'gmb', accountId);
}

/* ---------------- Token exchange + refresh ---------------- */

function qs(p: Record<string, string>): string {
  return Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

interface GTokens {
  access: string;
  refresh: string;
  expiresAt: number;
}

export async function exchangeGmbCode(code: string): Promise<GTokens> {
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
  if (!j?.access_token) {
    throw new Error(`Google login failed. ${String(j?.error_description ?? j?.error ?? `HTTP ${r.status}`).slice(0, 140)}`);
  }
  return {
    access: String(j.access_token),
    refresh: String(j.refresh_token ?? ''),
    expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
  };
}

export async function refreshGmbToken(refreshToken: string): Promise<GTokens> {
  const r = await fetch(YT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token) {
    throw new Error(`Google session expired — reconnect Google Business. ${String(j?.error ?? '').slice(0, 80)}`);
  }
  return {
    access: String(j.access_token),
    refresh: String(j.refresh_token ?? refreshToken),
    expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
  };
}

/** Valid access token for an account (refresh-first when stale). */
export async function getValidGmb(accountId?: string): Promise<string> {
  const f = await loadProviderFields('gmb', accountId);
  const exp = typeof f.gmExpiresAt === 'number' ? f.gmExpiresAt : 0;
  if (exp > Date.now() + 60000 && typeof f.gmAccessToken === 'string' && f.gmAccessToken) {
    return f.gmAccessToken;
  }
  const refresh = typeof f.gmRefreshToken === 'string' ? f.gmRefreshToken : '';
  if (!refresh) throw new Error('Google session expired — reconnect Google Business in Connect.');
  const t = await refreshGmbToken(refresh);
  await saveProviderFields(
    'gmb',
    { gmAccessToken: t.access, gmRefreshToken: t.refresh, gmExpiresAt: t.expiresAt },
    accountId,
  );
  return t.access;
}

/* ---------------- Locations (connect-time picker source) ---------------- */

export interface GmbLocation {
  name: string;
  title: string;
}

function gerrMessage(j: any, status: number): string {
  const m = j?.error?.message ?? j?.error ?? j?.message;
  const base = typeof m === 'string' && m ? m : `HTTP ${status}`;
  if (/403|permission|disabled|not been used/i.test(base) || status === 403) {
    return `Google Cloud project needs Business Profile API access approved (one-time allow-list). ${base}`;
  }
  return base;
}

export async function fetchGmbLocations(accessToken: string): Promise<GmbLocation[]> {
  const out: GmbLocation[] = [];
  const ar = await fetch(`${API_ACCOUNTS}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const aj: any = await ar.json().catch(() => ({}));
  if (!ar.ok) throw new Error(gerrMessage(aj, ar.status));
  for (const a of (aj?.accounts ?? []) as { name: string; accountName?: string }[]) {
    const lr = await fetch(
      `${API_BI}/${a.name}/locations?pageSize=100&readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const lj: any = await lr.json().catch(() => ({}));
    if (!lr.ok) {
      // Account without Business Profile access — skip silently.
      continue;
    }
    for (const l of (lj?.locations ?? []) as { name: string; title?: string }[]) {
      out.push({ name: l.name, title: l.title || a.accountName || l.name });
    }
  }
  return out;
}

/* ------------------------- Complete the login ------------------------- */

/** code → tokens persisted at account level; locations fetched by the caller
 *  for the staged pick (each location clones into its own row). */
export async function completeGmbLogin(code: string, accountId?: string): Promise<void> {
  const t = await exchangeGmbCode(code);
  await saveProviderFields(
    'gmb',
    {
      gmAccessToken: t.access,
      gmRefreshToken: t.refresh,
      gmExpiresAt: t.expiresAt,
      gmLocation: undefined,
    },
    accountId,
  );
}
