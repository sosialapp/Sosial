/**
 * Reddit OAuth for connect (device-side, mirrors the web oauth-exchange
 * driver: Basic-auth code exchange, /api/v1/me profile, subscribed-subreddit
 * list for the connect picker). Refresh tokens from duration=permanent
 * never expire; access tokens die hourly and mint silently from them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RD_API, RD_AUTH_ENDPOINT, RD_CLIENT_ID, RD_CLIENT_SECRET, RD_SCOPES,
  RD_TOKEN_ENDPOINT, RD_UA,
} from './redditConfig';
import { BRIDGE_URL, appReturnUrl, openAuth } from './metaAuth';
import { loadProviderFields, saveProviderFields } from './metaStore';

function basic(): string {
  // Hermes-safe base64 of id:secret (ASCII by construction).
  const bin = `${RD_CLIENT_ID}:${RD_CLIENT_SECRET}`;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const bytes = Array.from(bin).map((c) => c.charCodeAt(0));
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    const b1 = bytes[i++] ?? 0;
    const b2 = bytes[i++] ?? 0;
    const t = (b0 << 16) | (b1 << 8) | b2;
    out +=
      chars[(t >> 18) & 63] +
      chars[(t >> 12) & 63] +
      (i - 1 > bytes.length ? '=' : chars[(t >> 6) & 63]) +
      (i > bytes.length ? '=' : chars[t & 63]);
  }
  return `Basic ${out}`;
}

function qs(p: Record<string, string>): string {
  return Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/* ---------------- Login (same bridge page as Meta/TikTok/X) ---------------- */

export async function loginReddit(accountId?: string): Promise<boolean> {
  const url =
    `${RD_AUTH_ENDPOINT}?${qs({
      response_type: 'code',
      client_id: RD_CLIENT_ID,
      redirect_uri: BRIDGE_URL,
      duration: 'permanent',
      scope: RD_SCOPES.join(' '),
      state: appReturnUrl(),
    })}`;
  return openAuth(url, 'reddit', accountId);
}

export interface RdTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function exchangeRedditCode(code: string): Promise<RdTokens> {
  const r = await fetch(RD_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: basic(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': RD_UA,
    },
    body: qs({ grant_type: 'authorization_code', code, redirect_uri: BRIDGE_URL }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j.access_token) {
    throw new Error(`Reddit login failed. ${String(j.error_description ?? j.error ?? `HTTP ${r.status}`).slice(0, 140)}`);
  }
  return {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token ?? ''),
    expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
  };
}

export interface RdProfile {
  username: string;
  userId: string;
  avatar?: string;
}

export async function fetchRedditProfile(accessToken: string): Promise<RdProfile> {
  const r = await fetch(`${RD_API}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': RD_UA },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.name) throw new Error('Could not read your Reddit profile.');
  return {
    username: String(j.name),
    userId: String(j.id ?? ''),
    avatar: typeof j.icon_img === 'string' && j.icon_img ? j.icon_img : undefined,
  };
}

export interface RdSub {
  name: string;
  title: string;
  subscribers: number;
}

/** Subscribed subreddits for the connect picker (up to ~200). */
export async function fetchRedditSubreddits(accessToken: string): Promise<RdSub[]> {
  const out: RdSub[] = [];
  let after = '';
  for (let page = 0; page < 3 && out.length < 200; page++) {
    const q = after ? `?limit=100&after=${encodeURIComponent(after)}` : '?limit=100';
    const r = await fetch(`${RD_API}/subreddits/mine/subscriber${q}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': RD_UA },
    });
    const j: any = await r.json().catch(() => ({}));
    const kids: any[] = j?.data?.children ?? [];
    for (const k of kids) {
      const name = k?.data?.display_name;
      if (typeof name === 'string' && name) {
        out.push({
          name,
          title: typeof k.data.title === 'string' && k.data.title ? k.data.title : `r/${name}`,
          subscribers: Number(k?.data?.subscribers ?? 0),
        });
      }
    }
    after = typeof j?.data?.after === 'string' ? j.data.after : '';
    if (!after) break;
  }
  return out;
}

/* ------------------------- Complete + silent refresh ------------------------ */

const VERIFIER_KEY = 'sosial_reddit_last_code_v1';

/** code → profile + tokens persisted; returns the display name. */
export async function completeRedditLogin(code: string, accountId?: string): Promise<{ name?: string }> {
  if ((await AsyncStorage.getItem(VERIFIER_KEY)) === code) {
    // Same code replayed (browser + link event) — already handled.
    const existing = await loadProviderFields('reddit', accountId);
    return { name: (existing.rdUserName as string | undefined) ?? undefined };
  }
  try {
    await AsyncStorage.setItem(VERIFIER_KEY, code);
  } catch {}
  const t = await exchangeRedditCode(code);
  const me = await fetchRedditProfile(t.accessToken);
  await saveProviderFields(
    'reddit',
    {
      // Destination subreddit is picked next (staged) — store account-level
      // fields now so they clone into every per-subreddit row.
      rdAccessToken: t.accessToken,
      rdRefreshToken: t.refreshToken,
      rdExpiresAt: t.expiresAt,
      rdUserId: me.userId,
      rdUserName: me.username,
      avatar: me.avatar,
      rdSubreddit: undefined,
    },
    accountId,
  );
  return { name: me.username };
}

/** Silent mint — Reddit refresh tokens are permanent, access rotates. */
export async function refreshRedditToken(refreshToken: string): Promise<RdTokens> {
  const r = await fetch(RD_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: basic(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': RD_UA,
    },
    body: qs({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j.access_token) {
    throw new Error(`Reddit session expired — reconnect Reddit. ${String(j.error ?? `HTTP ${r.status}`).slice(0, 80)}`);
  }
  return {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token ?? refreshToken),
    expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000,
  };
}

/** Valid access token for an account (refresh-first when stale). */
export async function getValidRedditToken(accountId?: string): Promise<string> {
  const f = await loadProviderFields('reddit', accountId);
  const exp = typeof f.rdExpiresAt === 'number' ? f.rdExpiresAt : 0;
  if (exp > Date.now() + 60000 && typeof f.rdAccessToken === 'string' && f.rdAccessToken) {
    return f.rdAccessToken;
  }
  const refresh = typeof f.rdRefreshToken === 'string' ? f.rdRefreshToken : '';
  if (!refresh) throw new Error('Reddit session expired — reconnect Reddit in Connect.');
  const t = await refreshRedditToken(refresh);
  await saveProviderFields(
    'reddit',
    { rdAccessToken: t.accessToken, rdRefreshToken: t.refreshToken, rdExpiresAt: t.expiresAt },
    accountId,
  );
  return t.accessToken;
}
