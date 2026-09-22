/**
 * Server-side avatar backfill. Every cloud channel's tokens live in Vault, so
 * the worker can fetch each provider's profile picture itself and write it to
 * connected_channels.metadata.avatar — the field the web app renders. This is
 * what lets avatars appear without the user ever opening the mobile app.
 *
 * Failure policy: best-effort. A dead/expired token logs a warning and leaves
 * the channel status untouched (publishing owns that lifecycle).
 */
import { readSecret } from './db';
import { restPatch } from './rest';
import { required } from './env';
import { info, warn } from './logger';
import { ensureToken as ensureTikTokToken } from './tiktok';
import { ensureToken as ensureXToken } from './x';
import { ensureToken as ensureLinkedInToken } from './linkedin';
import { ensureToken as ensurePinterestToken } from './pinterest';
import { ensureToken as ensureYouTubeToken } from './youtube';
import { ensureSession as ensureBlueskySession } from './bsky';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';
const IG_GRAPH = 'https://graph.instagram.com';
const THREADS_API = 'https://graph.threads.net';
const X_API = 'https://api.x.com/2';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const PIN_API = 'https://api.pinterest.com/v5';
const LI_API = 'https://api.linkedin.com';
const TT_API = 'https://open.tiktokapis.com/v2';

export interface TokenRow {
  access_token_secret_id: string | null;
  refresh_token_secret_id: string | null;
  expires_at: string | null;
}

export interface ChannelRow {
  id: string;
  workspace_id: string;
  provider: string;
  external_id: string;
  instance_url: string | null;
  metadata: Record<string, any> | null;
  status?: string;
  channel_tokens: TokenRow | TokenRow[] | null;
}

function base(): string {
  return required('WORKER_SUPABASE_URL').replace(/\/+$/, '');
}

function key(): string {
  return required('WORKER_SERVICE_ROLE_KEY');
}

function errText(j: any, fallback: string): string {
  const m = j?.error?.message ?? j?.message ?? j?.error_description ?? j?.error;
  if (typeof m === 'string' && m) return m;
  if (m && typeof m === 'object') return fallback;
  return fallback;
}

export function tokenRow(c: ChannelRow): TokenRow {
  const t = Array.isArray(c.channel_tokens) ? c.channel_tokens[0] : c.channel_tokens;
  return t ?? { access_token_secret_id: null, refresh_token_secret_id: null, expires_at: null };
}

/**
 * A Bundle-shaped object is enough for the provider refresh helpers: they read
 * only secrets + channel.id/external_id/instance_url/metadata.
 */
export function bundleFor(c: ChannelRow, t: TokenRow): any {
  return {
    target: { id: '', provider: c.provider, caption: null, options: {}, status: 'avatars' },
    post: { id: '', title: '', body: '' },
    media: [],
    channel: {
      id: c.id,
      external_id: c.external_id,
      instance_url: c.instance_url,
      metadata: c.metadata ?? {},
    },
    secrets: {
      access_secret_id: t.access_token_secret_id,
      refresh_secret_id: t.refresh_token_secret_id,
      expires_at: t.expires_at,
    },
  };
}

async function directToken(c: ChannelRow, t: TokenRow): Promise<string> {
  if (!t.access_token_secret_id) {
    throw new Error(`${c.provider} token missing — reconnect the channel.`);
  }
  const v = await readSecret(t.access_token_secret_id);
  if (!v) throw new Error(`${c.provider} token unavailable — reconnect the channel.`);
  return v;
}

/** Fresh access token for a channel, refreshing via the provider helper. */
async function accessToken(c: ChannelRow, t: TokenRow): Promise<string> {
  const b = bundleFor(c, t);
  switch (c.provider) {
    case 'tiktok':
      return ensureTikTokToken(b);
    case 'x':
      return ensureXToken(b);
    case 'linkedin':
      return ensureLinkedInToken(b);
    case 'pinterest':
      return ensurePinterestToken(b);
    case 'youtube':
      return ensureYouTubeToken(b);
    case 'bluesky':
      return (await ensureBlueskySession(b)).token;
    default:
      return directToken(c, t);
  }
}

async function getJson(url: string, token: string): Promise<any> {
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errText(j, `${r.status}`));
  return j;
}

function firstString(...vals: any[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

/** Resolve the provider profile picture URL for one channel. */
async function avatarUrl(c: ChannelRow, token: string): Promise<string> {
  const ext = c.external_id;
  switch (c.provider) {
    case 'facebook': {
      const r = await fetch(
        `${FB_GRAPH}/${encodeURIComponent(ext)}/picture?redirect=false&type=normal&width=320&access_token=${encodeURIComponent(token)}`,
      );
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errText(j, `${r.status}`));
      return firstString(j?.data?.url);
    }
    case 'instagram': {
      const j = await getJson(`${IG_GRAPH}/me?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(token)}`, '');
      return firstString(j?.profile_picture_url);
    }
    case 'threads': {
      const j = await getJson(`${THREADS_API}/v1.0/me?fields=id,username,threads_profile_picture_url`, token);
      return firstString(j?.threads_profile_picture_url);
    }
    case 'tiktok': {
      const j = await getJson(`${TT_API}/user/info/?fields=open_id,avatar_url`, token);
      return firstString(j?.data?.user?.avatar_url);
    }
    case 'x': {
      const j = await getJson(`${X_API}/users/${encodeURIComponent(ext)}?user.fields=profile_image_url`, token);
      return firstString(j?.data?.profile_image_url).replace(/_normal(\.\w+)$/, '$1');
    }
    case 'youtube': {
      const j = await getJson(`${YT_API}/channels?part=snippet&mine=true`, token);
      const th = j?.items?.[0]?.snippet?.thumbnails ?? {};
      return firstString(th.high?.url, th.medium?.url, th.default?.url);
    }
    case 'pinterest': {
      const j = await getJson(`${PIN_API}/user_account`, token);
      return firstString(j?.profile_image?.medium_https, j?.profile_image?.small_https, j?.profile_image?.large_https);
    }
    case 'linkedin': {
      const j = await getJson(`${LI_API}/v2/userinfo`, token);
      return firstString(j?.picture);
    }
    case 'bluesky': {
      const pds = (c.instance_url || 'https://bsky.social').replace(/\/+$/, '');
      const j = await getJson(
        `${pds}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(ext)}`,
        '',
      );
      return firstString(j?.avatar);
    }
    case 'mastodon': {
      const inst = (c.instance_url || '').replace(/\/+$/, '');
      if (!inst) throw new Error('Mastodon channel missing instance URL.');
      const j = await getJson(`${inst}/api/v1/accounts/verify_credentials`, token);
      return firstString(j?.avatar, j?.avatar_static);
    }
    default:
      throw new Error(`no avatar fetcher for provider '${c.provider}'`);
  }
}

async function listChannels(): Promise<ChannelRow[]> {
  const url =
    `${base()}/rest/v1/connected_channels?status=eq.connected` +
    `&select=id,workspace_id,provider,external_id,instance_url,metadata,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)` +
    `&limit=1000`;
  const r = await fetch(url, {
    headers: { apikey: key(), Authorization: `Bearer ${key()}` },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`list connected_channels (${r.status}): ${t.slice(0, 200)}`);
  }
  const j: any = await r.json().catch(() => []);
  return Array.isArray(j) ? (j as ChannelRow[]) : [];
}

/**
 * Fetch + persist avatars for every connected channel. Safe to call anytime:
 * existing avatars are kept unless `force` is set.
 */
export async function syncWorkspaceAvatars(
  workspaceId?: string,
  force = false,
): Promise<{ checked: number; saved: number; failed: string[] }> {
  const all = await listChannels();
  const rows = workspaceId ? all.filter((c) => c.workspace_id === workspaceId) : all;
  const failed: string[] = [];
  let saved = 0;
  let checked = 0;

  for (const c of rows) {
    const existing = c.metadata?.avatar;
    if (existing && !force) continue;
    checked++;
    const t = tokenRow(c);
    try {
      const token = await accessToken(c, t);
      const url = await avatarUrl(c, token);
      if (!url) throw new Error('provider returned no avatar');
      if (url === existing) continue;
      await restPatch('connected_channels', c.id, {
        metadata: { ...(c.metadata ?? {}), avatar: url },
        updated_at: new Date().toISOString(),
      });
      saved++;
    } catch (e: any) {
      failed.push(c.provider);
      warn(`avatar ${c.provider}/${c.external_id}: ${String(e?.message ?? e)}`);
    }
  }

  info(`sync_avatars: ${checked} missing, ${saved} saved${failed.length ? `, failed ${failed.join(',')}` : ''}`);
  return { checked, saved, failed };
}
