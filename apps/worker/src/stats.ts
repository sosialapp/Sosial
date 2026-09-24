/**
 * snapshot_analytics · live engagement for published posts.
 *
 * Ports the mobile app's postStats.ts: one stats read per sent post_target
 * by its saved remote id, upserted into post_stats (one row per target =
 * latest numbers). Per-post failures never kill the run — they're recorded
 * in the row's note; the job only throws when nothing at all succeeded, so
 * systematic breakage still backs off and retries.
 *
 * Token handling mirrors the publishers exactly: refreshable providers go
 * through their ensureToken helpers, the rest read the stored secret
 * (Meta family long-lived tokens, Mastodon non-expiring).
 */
import { rest, readSecret } from './db';
import { info, warn } from './logger';
import {
  bundleFor,
  tokenRow,
  type ChannelRow,
  type TokenRow,
} from './avatars';
import { ensureToken as ensureXToken } from './x';
import { ensureSession as ensureBlueskySession } from './bsky';
import { ensureToken as ensureLinkedInToken } from './linkedin';
import { ensureToken as ensurePinterestToken } from './pinterest';
import { ensureToken as ensureYouTubeToken } from './youtube';
const FB_GRAPH = 'https://graph.facebook.com/v21.0';
const IG_GRAPH = 'https://graph.instagram.com';
const THREADS_API = 'https://graph.threads.net';
const X_API = 'https://api.x.com/2';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const LI_API = 'https://api.linkedin.com';
const LI_VERSION = '202405';
const PIN_API = 'https://api.pinterest.com/v5';

/** How many recent sent targets one run inspects per channel. */
const MAX_TARGETS = 30;
/** Stats window for targets that carry a sent_at. */
const WINDOW_DAYS = 45;

export interface Stats {
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
  note?: string;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/* ------------------------------ channel ------------------------------ */

async function getChannel(channelId: string): Promise<{ c: ChannelRow; t: TokenRow } | null> {
  const rows = await rest<ChannelRow[]>(
    `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
      `&select=id,workspace_id,provider,external_id,instance_url,metadata,status,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)` +
      `&limit=1`,
  );
  const c = rows?.[0];
  if (!c) return null;
  const t = tokenRow(c);
  return { c, t };
}

async function directToken(c: ChannelRow, t: TokenRow): Promise<string> {
  if (!t.access_token_secret_id) {
    throw new Error(`${c.provider} token missing — reconnect the channel.`);
  }
  const v = await readSecret(t.access_token_secret_id);
  if (!v) throw new Error(`${c.provider} token unavailable — reconnect the channel.`);
  return v;
}

/** Fresh access token per provider (same rotation rules as publishing). */
async function accessToken(c: ChannelRow, t: TokenRow): Promise<string> {
  const b = bundleFor(c, t);
  switch (c.provider) {
    case 'x':
      return ensureXToken(b);
    case 'linkedin':
      return ensureLinkedInToken(b);
    case 'pinterest':
      return ensurePinterestToken(b);
    case 'youtube':
      return ensureYouTubeToken(b);
    default:
      return directToken(c, t);
  }
}

/** Bluesky session (token + pds host) with the publish-time rotation. */
async function blueskySession(c: ChannelRow, t: TokenRow): Promise<{ token: string; pdsHost: string }> {
  const sess = await ensureBlueskySession(bundleFor(c, t));
  return { token: sess.token, pdsHost: sess.pdsHost };
}

/** pdsHost is stored as a full URL — never prepend a second scheme. */
function bskyApi(pdsHost: string): string {
  const h = pdsHost.replace(/\/+$/, '');
  return (h.startsWith('http://') || h.startsWith('https://') ? h : `https://${h}`) + '/xrpc';
}

/* ------------------------------ per provider ------------------------------ */

async function jget(url: string, headers?: Record<string, string>): Promise<any> {
  const r = await fetch(url, { headers: headers ?? {} });
  return r.json().catch(() => ({}));
}

async function statsFor(c: ChannelRow, t: TokenRow, remoteId: string): Promise<Stats> {
  switch (c.provider) {
    case 'facebook': {
      const tok = encodeURIComponent(await accessToken(c, t));
      const core = await jget(`${FB_GRAPH}/${encodeURIComponent(remoteId)}?fields=shares&access_token=${tok}`);
      if (core?.error) throw new Error(core.error.message ?? 'Could not read post.');
      const out: Stats = { likes: 0, comments: 0, shares: num(core.shares?.count), views: null };
      let denied = false;
      const edge = async (path: 'likes' | 'comments') => {
        const j = await jget(`${FB_GRAPH}/${encodeURIComponent(remoteId)}/${path}?summary=total_count&limit=0&access_token=${tok}`);
        if (j?.error) {
          denied = true;
          return;
        }
        out[path] = num(j?.summary?.total_count);
      };
      await Promise.all([edge('likes'), edge('comments')]);
      if (denied) out.note = 'Like/comment counts need the pages_read_user_content permission on this login.';
      return out;
    }
    case 'instagram': {
      const tok = encodeURIComponent(await accessToken(c, t));
      const j = await jget(`${IG_GRAPH}/${encodeURIComponent(remoteId)}?fields=like_count,comments_count&access_token=${tok}`);
      if (j?.error) throw new Error(j.error.message ?? 'Could not read post.');
      return { likes: num(j.like_count), comments: num(j.comments_count), views: null, shares: 0 };
    }
    case 'threads': {
      const tok = await accessToken(c, t);
      const enc = encodeURIComponent(tok);
      const j = await jget(
        `${THREADS_API}/v1.0/${encodeURIComponent(remoteId)}?fields=like_count,reply_count,repost_count,view_count&access_token=${enc}`,
        { Authorization: `Bearer ${tok}` },
      );
      if (j?.error) throw new Error(j.error.message ?? 'Could not read post.');
      return {
        likes: num(j.like_count),
        comments: num(j.reply_count),
        views: typeof j.view_count === 'number' ? j.view_count : null,
        shares: num(j.repost_count),
      };
    }
    case 'x': {
      const token = await accessToken(c, t);
      const j = await jget(`${X_API}/tweets/${encodeURIComponent(remoteId)}?tweet.fields=public_metrics`, {
        Authorization: `Bearer ${token}`,
      });
      const pm = j?.data?.public_metrics;
      if (!pm) throw new Error(j?.errors?.[0]?.detail ?? 'Could not read post.');
      return {
        likes: num(pm.like_count),
        comments: num(pm.reply_count),
        views: num(pm.impression_count) || null,
        shares: num(pm.retweet_count),
      };
    }
    case 'bluesky': {
      const { token, pdsHost } = await blueskySession(c, t);
      const j = await jget(
        `${bskyApi(pdsHost)}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(remoteId)}&depth=0`,
        { Authorization: `Bearer ${token}` },
      );
      const p = j?.thread?.post;
      if (!p) throw new Error('Could not read post.');
      return { likes: num(p.likeCount), comments: num(p.replyCount), views: null, shares: num(p.repostCount) };
    }
    case 'mastodon': {
      const token = await accessToken(c, t);
      const base = String(c.instance_url ?? '').replace(/\/+$/, '');
      if (!base) throw new Error('Mastodon channel missing its instance URL.');
      const j = await jget(`${base}/api/v1/statuses/${encodeURIComponent(remoteId)}`, {
        Authorization: `Bearer ${token}`,
      });
      if (!j?.id) throw new Error('Could not read post.');
      return {
        likes: num(j.favourites_count),
        comments: num(j.replies_count),
        views: null,
        shares: num(j.reblogs_count),
      };
    }
    case 'youtube': {
      const token = await accessToken(c, t);
      const j = await jget(`${YT_API}/videos?part=statistics&id=${encodeURIComponent(remoteId)}`, {
        Authorization: `Bearer ${token}`,
      });
      const s = Array.isArray(j?.items) ? j.items[0]?.statistics : undefined;
      if (!s) throw new Error('Could not read video.');
      return { likes: num(s.likeCount), comments: num(s.commentCount), views: num(s.viewCount) || null, shares: 0 };
    }
    case 'linkedin': {
      if (!remoteId.startsWith('urn:li:')) {
        return { likes: 0, comments: 0, shares: 0, views: null, note: 'No LinkedIn post id was saved — republish to track this post.' };
      }
      const token = await accessToken(c, t);
      const j = await jget(`${LI_API}/rest/socialActions/${encodeURIComponent(remoteId)}`, {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      });
      if (typeof j?.status === 'number' && j.status >= 400) {
        if (j.status === 401 || j.status === 403) {
          return { likes: 0, comments: 0, shares: 0, views: null, note: 'LinkedIn read permission not granted — reconnect LinkedIn, then retry.' };
        }
        throw new Error(j?.message ?? 'Could not read post.');
      }
      return {
        likes: num(j?.likesSummary?.totalLikes),
        comments: num(j?.commentsSummary?.totalComments),
        views: null,
        shares: 0,
      };
    }
    case 'pinterest': {
      const token = await accessToken(c, t);
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86400000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const j = await jget(
        `${PIN_API}/pins/${encodeURIComponent(remoteId)}/analytics` +
          `?start_date=${iso(start)}&end_date=${iso(end)}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`,
        { Authorization: `Bearer ${token}` },
      );
      if (j?.error || j?.message && /error/i.test(String(j.code ?? ''))) {
        throw new Error(j?.message ?? 'Pinterest analytics failed.');
      }
      const scope = Array.isArray(j?.daily_metrics) ? j.daily_metrics : j;
      const sumMetric = (names: string[]): number => {
        let total = 0;
        const rows = Array.isArray(scope) ? scope : [scope];
        for (const row of rows) {
          const m = row?.metrics ?? {};
          for (const name of names) total += num(m[name]?.value ?? m[name]);
        }
        return total;
      };
      const impressions = sumMetric(['IMPRESSION']);
      return {
        likes: sumMetric(['SAVE']),
        comments: 0,
        views: impressions || null,
        shares: sumMetric(['PIN_CLICK', 'OUTBOUND_CLICK']),
        note: 'Saves count as likes — Pinterest exposes no comment API.',
      };
    }
    default:
      throw new Error(`Stats aren't available for ${c.provider} via its API.`);
  }
}

/* ------------------------------ the job ------------------------------ */

interface TargetRow {
  id: string;
  post_id: string;
  remote_id: string | null;
  provider: string;
}

export async function snapshotChannel(channelId: string): Promise<{ updated: number; failed: number; skipped: string | null }> {
  const got = await getChannel(channelId);
  if (!got) return { updated: 0, failed: 0, skipped: 'channel gone' };
  const { c, t } = got;
  if (c.status !== 'connected') return { updated: 0, failed: 0, skipped: `channel ${c.status}` };
  if (c.provider === 'tiktok') {
    // TikTok has no post-read API — skip with a clean no-op (mobile shows zeros).
    return { updated: 0, failed: 0, skipped: 'tiktok has no post stats API' };
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  const targets = await rest<TargetRow[]>(
    `/rest/v1/post_targets?channel_id=eq.${encodeURIComponent(c.id)}` +
      `&status=eq.sent&remote_id=not.is.null&select=id,post_id,remote_id,provider` +
      `&order=sent_at.desc&limit=${MAX_TARGETS}`,
  );
  if (!targets?.length) return { updated: 0, failed: 0, skipped: 'no sent posts yet' };

  let updated = 0;
  let failed = 0;
  for (const target of targets) {
    const remoteId = String(target.remote_id ?? '').split(',')[0].trim();
    if (!remoteId) continue;
    try {
      const s = await statsFor(c, t, remoteId);
      await rest('/rest/v1/post_stats', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          post_target_id: target.id,
          workspace_id: c.workspace_id,
          post_id: target.post_id,
          channel_id: c.id,
          provider: c.provider,
          likes: s.likes,
          comments: s.comments,
          shares: s.shares,
          views: s.views,
          note: s.note ?? null,
          fetched_at: new Date().toISOString(),
        }),
      });
      updated += 1;
    } catch (e: any) {
      failed += 1;
      warn(`stats ${c.provider}/${c.external_id} target ${target.id}: ${String(e?.message ?? e).slice(0, 160)}`);
    }
  }
  info(`snapshot ${c.provider}/${c.external_id}: ${updated} updated, ${failed} failed`);
  // Only a total failure is a job failure — a systematic breakage (expired
  // token, API change) should back off and retry.
  if (updated === 0 && failed > 0) {
    throw new Error(`all ${failed} stat reads failed for ${c.provider}/${c.external_id}`);
  }
  return { updated, failed, skipped: null };
}
