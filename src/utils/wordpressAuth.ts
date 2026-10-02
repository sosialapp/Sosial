/**
 * WordPress Application Password validation for connect (device-side,
 * mirrors the connect-wordpress edge function: users/me proves the triple,
 * root gives the site display name).
 */

export function siteBase(raw: string): string {
  const base = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    throw new Error('Site URL must start with http(s).');
  }
  return base;
}

function auth(username: string, appPassword: string): string {
  // btoa is ASCII-safe here (user + app password are ASCII by construction).
  const bin = `${username}:${appPassword}`;
  let out = '';
  // Minimal base64 without Buffer (Hermes-safe).
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let i = 0;
  const bytes = Array.from(bin).map((c) => c.charCodeAt(0));
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

export function wpAuthHeader(username: string, appPassword: string): string {
  return auth(username, appPassword);
}

async function wp<T>(base: string, authHeader: string, path: string): Promise<T> {
  const res = await fetch(`${base}/wp-json${path}`, { headers: { Authorization: authHeader } });
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !json) {
    throw new Error(
      typeof json?.message === 'string' && json.message ? json.message : `HTTP ${res.status}`,
    );
  }
  return json;
}

export async function validateWordPress(
  siteUrl: string,
  username: string,
  appPassword: string,
): Promise<{ userId: string; siteName: string; avatar?: string }> {
  const base = siteBase(siteUrl);
  const header = auth(username.trim(), appPassword.trim());
  let me: { id: number };
  try {
    me = await wp<{ id: number }>(base, header, '/wp/v2/users/me');
  } catch (e) {
    throw new Error(
      `WordPress rejected those credentials: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Check Users → Profile → Application Passwords (needs WP 5.6+).',
    );
  }
  let siteName = base.replace(/^https?:\/\//i, '');
  let avatar: string | undefined;
  try {
    const root = await wp<{ name?: string; site_icon?: number }>(base, header, '/');
    if (root.name) siteName = root.name;
    // Site icon, best-effort — icon-less sites keep the brand disc.
    const iconId = Number(root.site_icon ?? 0);
    if (iconId > 0) {
      try {
        const media = await wp<{
          source_url?: string;
          media_details?: { sizes?: Record<string, { source_url?: string }> };
        }>(base, header, `/wp/v2/media/${iconId}`);
        const thumb =
          media?.media_details?.sizes?.thumbnail?.source_url ??
          media?.media_details?.sizes?.medium?.source_url ??
          media?.source_url;
        if (typeof thumb === 'string' && thumb) avatar = thumb;
      } catch {
        /* no avatar */
      }
    }
  } catch {
    /* display-only */
  }
  return { userId: String(me.id), siteName, avatar };
}
