import { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_AUTH_ENDPOINT, YT_TOKEN_ENDPOINT, YT_API, YT_SCOPES } from './ytConfig';
import { BRIDGE_URL, appReturnUrl, openAuth } from './metaAuth';
import { loadProviderFields, saveProviderFields } from './metaStore';

/* ---------------- Login (same bridge page as the other OAuth channels) ---------------- */

export async function loginYouTube(accountId?: string): Promise<boolean> {
  const url =
    `${YT_AUTH_ENDPOINT}?response_type=code` +
    `&client_id=${encodeURIComponent(YT_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(BRIDGE_URL)}` +
    `&scope=${encodeURIComponent(YT_SCOPES.join(' '))}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(appReturnUrl())}`;
  return openAuth(url, 'youtube', accountId);
}

/* ---------------- Token exchange + refresh ---------------- */

function yerr(j: any, fallback: string): string {
  const m =
    j?.error_description ||
    (typeof j?.error === 'string' ? j.error : j?.error?.message) ||
    j?.message;
  const base = typeof m === 'string' && m.length > 0 ? m : fallback;
  if (/redirect_uri|client_id|unauthorized_client/i.test(base)) {
    return `${base} — check the Client ID/Secret in ytConfig.ts and the redirect URI in Google Cloud.`;
  }
  return base;
}

function qs(p: Record<string, string>): string {
  return Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

interface YtTokens {
  access: string;
  refresh: string;
  /** epoch ms */
  expiresAt: number;
}

export async function exchangeYtCode(code: string): Promise<YtTokens> {
  const r = await fetch(YT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs({
      grant_type: 'authorization_code',
      code,
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      redirect_uri: BRIDGE_URL,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token) throw new Error(yerr(j, 'YouTube login exchange failed.'));
  return {
    access: String(j.access_token),
    refresh: String(j.refresh_token ?? ''),
    expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000,
  };
}

export async function refreshYtToken(refreshToken: string): Promise<YtTokens> {
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
  if (!j?.access_token) throw new Error(yerr(j, 'YouTube session expired — reconnect YouTube.'));
  return {
    access: String(j.access_token),
    // Google only returns a refresh token on first consent — keep the old one
    refresh: String(j.refresh_token ?? refreshToken),
    expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000,
  };
}

/** Single entry every YouTube call uses — refreshes 10 min before expiry. */
export async function getValidYt(accountId?: string, force = false): Promise<{ token: string }> {
  const f = await loadProviderFields('youtube', accountId);
  const access = f.ytAccessToken as string | undefined;
  const expiresAt = f.ytExpiresAt as number | undefined;
  const refresh = f.ytRefreshToken as string | undefined;
  if (!refresh && !access) throw new Error('YouTube not connected');
  if (!force && access && expiresAt && Date.now() < expiresAt - 600000) {
    return { token: access };
  }
  if (!refresh) {
    if (access && expiresAt && Date.now() < expiresAt) return { token: access };
    throw new Error('YouTube session expired — reconnect YouTube.');
  }
  const t = await refreshYtToken(refresh);
  await saveProviderFields('youtube', {
    ytAccessToken: t.access,
    ytRefreshToken: t.refresh || undefined,
    ytExpiresAt: t.expiresAt,
  }, accountId);
  return { token: t.access };
}

export async function fetchYtProfile(token: string): Promise<{ name?: string; avatar?: string }> {
  const r = await fetch(`${YT_API}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  const title = j?.items?.[0]?.snippet?.title;
  if (!r.ok || !title) throw new Error(yerr(j, 'Could not read your YouTube channel.'));
  const thumbs = j?.items?.[0]?.snippet?.thumbnails;
  const avatar = thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url;
  return { name: String(title), avatar: avatar ? String(avatar) : undefined };
}

/** Full login: exchange the code, read the channel title, save tokens. */
export async function completeYtLogin(code: string, accountId?: string): Promise<{ name?: string }> {
  const t = await exchangeYtCode(code);
  await saveProviderFields('youtube', {
    ytAccessToken: t.access,
    ytRefreshToken: t.refresh || undefined,
    ytExpiresAt: t.expiresAt,
  }, accountId);
  let name: string | undefined;
  let avatar: string | undefined;
  try {
    const prof = await fetchYtProfile(t.access);
    name = prof.name;
    avatar = prof.avatar;
  } catch {}
  await saveProviderFields('youtube', { ytChannelName: name, avatar }, accountId);
  return { name };
}
