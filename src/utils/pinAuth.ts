import { PIN_CLIENT_ID, PIN_CLIENT_SECRET, PIN_AUTH_ENDPOINT, PIN_TOKEN_ENDPOINT, PIN_API, PIN_SCOPES } from './pinConfig';
import { BRIDGE_URL, appReturnUrl, openAuth } from './metaAuth';
import { loadProviderFields, saveProviderFields } from './metaStore';

/* ---------------- Login (same bridge page as the other OAuth channels) ---------------- */

export async function loginPinterest(accountId?: string): Promise<boolean> {
  const url =
    `${PIN_AUTH_ENDPOINT}?response_type=code` +
    `&client_id=${encodeURIComponent(PIN_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(BRIDGE_URL)}` +
    `&scope=${encodeURIComponent(PIN_SCOPES.join(','))}` +
    `&state=${encodeURIComponent(appReturnUrl())}`;
  return openAuth(url, 'pinterest', accountId);
}

/* ---------------- Token exchange (HTTP Basic, not body creds) ---------------- */

/** App ID + secret are ASCII-safe, so a tiny encoder beats pulling a lib. */
function b64(s: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  for (let i = 0; i < s.length; i += 3) {
    const a = s.charCodeAt(i);
    const b = i + 1 < s.length ? s.charCodeAt(i + 1) : NaN;
    const c = i + 2 < s.length ? s.charCodeAt(i + 2) : NaN;
    const n = (a << 16) | ((isNaN(b) ? 0 : b) << 8) | (isNaN(c) ? 0 : c);
    out +=
      chars[(n >> 18) & 63] +
      chars[(n >> 12) & 63] +
      (isNaN(b) ? '=' : chars[(n >> 6) & 63]) +
      (isNaN(c) ? '=' : chars[n & 63]);
  }
  return out;
}

function perr(j: any, fallback: string): string {
  const m =
    j?.error_description ||
    (typeof j?.error === 'string' ? j.error : j?.error?.message) ||
    j?.message;
  return typeof m === 'string' && m.length > 0 ? m : fallback;
}

function qs(p: Record<string, string>): string {
  return Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

interface PinTokens {
  access: string;
  refresh: string;
  /** epoch ms */
  expiresAt: number;
}

async function tokenRequest(body: Record<string, string>): Promise<PinTokens> {
  const r = await fetch(PIN_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${b64(`${PIN_CLIENT_ID}:${PIN_CLIENT_SECRET}`)}`,
    },
    body: qs(body),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token) {
    throw new Error(perr(j, 'Pinterest login exchange failed — check the App ID/secret and redirect URI.'));
  }
  return {
    access: String(j.access_token),
    refresh: String(j.refresh_token ?? ''),
    expiresAt: Date.now() + (Number(j.expires_in) || 2592000) * 1000,
  };
}

export async function exchangePinCode(code: string): Promise<PinTokens> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: BRIDGE_URL,
  });
}

export async function refreshPinToken(refreshToken: string): Promise<PinTokens> {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: PIN_SCOPES.join(','),
  });
}

/** Single entry every Pinterest call uses — refreshes up to a day before expiry. */
export async function getValidPin(accountId?: string, force = false): Promise<{ token: string }> {
  const f = await loadProviderFields('pinterest', accountId);
  const access = f.pinAccessToken as string | undefined;
  const expiresAt = f.pinExpiresAt as number | undefined;
  const refresh = f.pinRefreshToken as string | undefined;
  if (!access) throw new Error('Pinterest not connected');
  if (!force && expiresAt && Date.now() < expiresAt - 24 * 3600 * 1000) {
    return { token: access };
  }
  if (!refresh) {
    if (!expiresAt || Date.now() >= expiresAt) throw new Error('Pinterest session expired — reconnect Pinterest.');
    return { token: access };
  }
  const t = await refreshPinToken(refresh);
  await saveProviderFields('pinterest', {
    pinAccessToken: t.access,
    pinRefreshToken: t.refresh || undefined,
    pinExpiresAt: t.expiresAt,
  }, accountId);
  return { token: t.access };
}

export async function fetchPinProfile(token: string): Promise<{ username?: string; avatar?: string }> {
  const r = await fetch(`${PIN_API}/user_account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.username) throw new Error(perr(j, 'Could not read your Pinterest profile.'));
  const img = j.profile_image;
  const avatar = img?.medium_https ?? img?.small_https ?? img?.large_https;
  return { username: String(j.username), avatar: avatar ? String(avatar) : undefined };
}

/** Full login: exchange the code, read the profile, save tokens. Board comes later. */
export async function completePinLogin(code: string, accountId?: string): Promise<{ name?: string }> {
  const t = await exchangePinCode(code);
  await saveProviderFields('pinterest', {
    pinAccessToken: t.access,
    pinRefreshToken: t.refresh || undefined,
    pinExpiresAt: t.expiresAt,
  }, accountId);
  let name: string | undefined;
  let avatar: string | undefined;
  try {
    const prof = await fetchPinProfile(t.access);
    name = prof.username ? `@${prof.username}` : undefined;
    avatar = prof.avatar;
  } catch {}
  await saveProviderFields('pinterest', { pinUsername: name, avatar }, accountId);
  return { name };
}
