/**
 * snapshot_analytics · live engagement for published posts.
 *
 * Ports the mobile app's postStats.ts: one stats read per sent post_target
 * by its saved remote id, upserted into post_stats (one row per target =
 * latest numbers). Per-post failures never kill the run, they're recorded
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
import { ensureToken as ensurePinterestToken, pinContentApi, pinContentToken } from './pinterest';
import { ensureToken as ensureYouTubeToken } from './youtube';
import { ensureToken as ensureGmbToken } from './gmb';
import { STATS_MAX_AGE, statsDue } from './cadence';
import { budgetSpent, inBackoff, noteResponse } from './usage';
export const FB_GRAPH = 'https://graph.facebook.com/v21.0';
export const IG_GRAPH = 'https://graph.instagram.com';
export const THREADS_API = 'https://graph.threads.net';
const X_API = 'https://api.x.com/2';
export const YT_API = 'https://www.googleapis.com/youtube/v3';
const LI_API = 'https://api.linkedin.com';
const LI_VERSION = '202405';
export const PIN_API = 'https://api.pinterest.com/v5';
const GMB_BI = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GMB_PERF = 'https://businessprofileperformance.googleapis.com/v1';

/** Most sent targets one run considers per channel; only the due ones are read. */
const MAX_TARGETS = 100;

/**
 * What the AUDIENCE did to one of our posts. Our own replies, self-likes and
 * self-reposts are stripped (the platform totals include them), and saves and
 * clicks keep their own columns instead of padding likes or shares. Quotes ride
 * inside `shares` where the provider reports them (X retweet_count +
 * quote_count, Threads reposts + quotes, Mastodon reblogs + quotes).
 * Interactions = likes + comments + shares + saves, clicks excluded
 * (apps/web/src/lib/analyticsMath.ts, mirrored at src/utils/analyticsMath.ts).
 */
export interface Stats {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  views: number | null;
  note?: string;
}

export const ZERO = { likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: null } as const;

export const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** Threads insights rows → { metric: value }. Media metrics answer with
 *  values[0].value, user metrics with total_value.value; accept both. */
function threadsMetrics(j: any): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  for (const row of Array.isArray(j?.data) ? j.data : []) {
    const v = row?.values?.[0]?.value ?? row?.total_value?.value;
    if (typeof row?.name === 'string' && typeof v === 'number') out[row.name] = v;
  }
  return out;
}

/* ------------------------------ channel ------------------------------ */

export async function getChannel(channelId: string): Promise<{ c: ChannelRow; t: TokenRow } | null> {
  const rows = await rest<ChannelRow[]>(
    `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
      `&select=id,workspace_id,provider,external_id,instance_url,metadata,status,api_backoff_until,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)` +
      `&limit=1`,
  );
  const c = rows?.[0];
  if (!c) return null;
  const t = tokenRow(c);
  return { c, t };
}

async function directToken(c: ChannelRow, t: TokenRow): Promise<string> {
  if (!t.access_token_secret_id) {
    throw new Error(`${c.provider} token missing, reconnect the channel.`);
  }
  const v = await readSecret(t.access_token_secret_id);
  if (!v) throw new Error(`${c.provider} token unavailable, reconnect the channel.`);
  return v;
}

/** Fresh access token per provider (same rotation rules as publishing). */
export async function accessToken(c: ChannelRow, t: TokenRow): Promise<string> {
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
    case 'gmb':
      return ensureGmbToken(b);
    default:
      return directToken(c, t);
  }
}

/** Bluesky session (token + pds host) with the publish-time rotation. */
export async function blueskySession(c: ChannelRow, t: TokenRow): Promise<{ token: string; pdsHost: string }> {
  const sess = await ensureBlueskySession(bundleFor(c, t));
  return { token: sess.token, pdsHost: sess.pdsHost };
}

/** pdsHost is stored as a full URL, never prepend a second scheme. */
export function bskyApi(pdsHost: string): string {
  const h = pdsHost.replace(/\/+$/, '');
  return (h.startsWith('http://') || h.startsWith('https://') ? h : `https://${h}`) + '/xrpc';
}

/* ------------------------------ per provider ------------------------------ */

export async function jget(url: string, headers?: Record<string, string>): Promise<any> {
  const r = await fetch(url, { headers: headers ?? {} });
  const j = await r.json().catch(() => ({}));
  noteResponse(r.status, r.headers, j);
  return j;
}

/** A follower count where 0 is data, not "unknown" (num() flattens both to 0,
 *  and `num(x) || null` then threw away every brand-new account's real zero). */
const count = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/* --------------------------- follower snapshots --------------------------- */

/**
 * Live follower count per provider, the web mirror of the mobile analytics
 * profile reads. Ported from src/utils/analytics.ts; unsupported providers
 * return null so the UI shows "-" instead of a fake zero.
 */
async function followersFor(c: ChannelRow, t: TokenRow): Promise<{ followers: number | null; note?: string }> {
  const token = async () => accessToken(c, t);
  switch (c.provider) {
    case 'facebook': {
      const tok = encodeURIComponent(await token());
      const prof = await jget(`${FB_GRAPH}/${encodeURIComponent(c.external_id)}?fields=fan_count,followers_count&access_token=${tok}`);
      if (prof?.error) throw new Error(prof.error.message ?? 'facebook profile read failed');
      return { followers: count(prof.followers_count) ?? count(prof.fan_count) };
    }
    case 'instagram': {
      const tok = encodeURIComponent(await token());
      const prof = await jget(`${IG_GRAPH}/me?fields=followers_count,media_count&access_token=${tok}`);
      if (prof?.error) throw new Error(prof.error.message ?? 'instagram profile read failed');
      return { followers: count(prof.followers_count) };
    }
    case 'threads': {
      const tok = await token();
      const enc = encodeURIComponent(tok);
      const prof = await jget(`${THREADS_API}/v1.0/me?fields=followers_count&access_token=${enc}`, {
        Authorization: `Bearer ${tok}`,
      });
      let followers = count(prof?.followers_count);
      if (followers === null) {
        // followers_count is a Total Value metric: { data: [{ total_value: { value } }] }
        const ins = await jget(
          `${THREADS_API}/v1.0/${encodeURIComponent(c.external_id)}/threads_insights?metric=followers_count&access_token=${enc}`,
          { Authorization: `Bearer ${tok}` },
        );
        const v = count(ins?.data?.[0]?.total_value?.value);
        if (v !== null) followers = v;
      }
      return { followers, note: followers === null ? 'Threads does not expose follower counts to this app yet.' : undefined };
    }
    case 'tiktok': {
      const tok = await token();
      const u = await jget('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count', {
        Authorization: `Bearer ${tok}`,
      });
      const data = u?.data?.user ?? u?.user;
      if (!data) throw new Error(u?.error?.message ?? 'tiktok profile read failed');
      return { followers: count(data.follower_count) };
    }
    case 'x': {
      const tok = await token();
      const prof = await jget(`${X_API}/users/me?user.fields=public_metrics`, {
        Authorization: `Bearer ${tok}`,
      });
      if (!prof?.data) throw new Error(prof?.detail ?? 'x profile read failed');
      return { followers: count(prof.data.public_metrics?.followers_count) };
    }
    case 'bluesky': {
      const sess = await ensureBlueskySession(bundleFor(c, t));
      const prof = await jget(
        `${bskyApi(sess.pdsHost)}/app.bsky.actor.getProfile?actor=${encodeURIComponent(c.external_id)}`,
        { Authorization: `Bearer ${sess.token}` },
      );
      return { followers: count(prof?.followersCount) };
    }
    case 'mastodon': {
      const tok = await token();
      const base = String(c.instance_url ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      if (!base) throw new Error('mastodon instance missing');
      const prof = await jget(`https://${base}/api/v1/accounts/verify_credentials`, {
        Authorization: `Bearer ${tok}`,
      });
      if (prof?.error) throw new Error(prof.error ?? 'mastodon profile read failed');
      return { followers: count(prof?.followers_count) };
    }
    case 'pinterest': {
      const tok = await token();
      const acct = await jget(`${PIN_API}/user_account`, { Authorization: `Bearer ${tok}` });
      if (acct?.message) throw new Error(acct.message);
      return { followers: count(acct?.follower_count) };
    }
    case 'youtube': {
      const tok = await token();
      const j = await jget(`${YT_API}/channels?part=statistics&mine=true`, {
        Authorization: `Bearer ${tok}`,
      });
      const item = j?.items?.[0];
      if (!item) throw new Error(j?.error?.message ?? 'youtube channel read failed');
      return { followers: count(item.statistics?.subscriberCount) };
    }
    case 'linkedin': {
      // Only Company Pages expose follower counts to third-party apps.
      const orgId = String((c.metadata as any)?.liOrgId ?? '');
      if (!orgId) return { followers: null, note: 'LinkedIn exposes no follower count for personal profiles, connect a Company Page to see followers.' };
      const tok = await token();
      const j = await jget(
        `${LI_API}/rest/organizationalEntityAudienceStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${orgId}`)}&audienceType0=ORGANIC`,
        { Authorization: `Bearer ${tok}`, 'LinkedIn-Version': LI_VERSION },
      );
      const total = j?.elements?.[0]?.totalMemberCount ?? j?.elements?.[0]?.followerCounts?.organicFollowerCount;
      return { followers: count(total) };
    }
    default:
      return { followers: null };
  }
}

/** Upsert the latest follower snapshot for one channel (PK = channel_id). */
async function snapshotFollowers(c: ChannelRow, t: TokenRow): Promise<void> {
  const out = await followersFor(c, t);
  await rest('/rest/v1/channel_stats', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      channel_id: c.id,
      workspace_id: c.workspace_id,
      provider: c.provider,
      followers: out.followers,
      note: out.note ?? null,
      fetched_at: new Date().toISOString(),
    }),
  });
  // p77: keep one row per channel per UTC day so analytics can draw an
  // audience trend. Re-runs the same day overwrite that day's row.
  if (out.followers !== null) {
    await rest('/rest/v1/channel_stats_history', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        channel_id: c.id,
        captured_on: new Date().toISOString().slice(0, 10),
        workspace_id: c.workspace_id,
        provider: c.provider,
        followers: out.followers,
      }),
    });
  }
}

export async function statsFor(c: ChannelRow, t: TokenRow, remoteId: string): Promise<Stats> {
  switch (c.provider) {
    case 'facebook': {
      const tok = encodeURIComponent(await accessToken(c, t));
      const id = encodeURIComponent(remoteId);
      // One read with the edges nested (was three calls per post). Every
      // reaction type, not just Like; viewer_reaction is the Page's own
      // reaction (we read with its token), which is not audience engagement.
      // filter(stream) counts replies too, matching what the comment sync
      // stores; our own replies come off in snapshotChannel.
      const edges =
        'reactions.summary(total_count,viewer_reaction).limit(0),comments.filter(stream).summary(total_count).limit(0)';
      let j = await jget(`${FB_GRAPH}/${id}?fields=${encodeURIComponent(`shares,${edges}`)}&access_token=${tok}`);
      let note: string | undefined;
      if (j?.error) {
        // Videos and reels are saved under the video id, and a Video has no
        // `shares` field: asking for it errors the whole read. Retry without.
        j = await jget(`${FB_GRAPH}/${id}?fields=${encodeURIComponent(edges)}&access_token=${tok}`);
        note = 'Facebook reports no share count for videos and reels.';
      }
      if (j?.error) {
        // The login may lack the permission for reactions/comments; shares
        // alone still say something. Nothing readable at all (deleted post,
        // expired token) is a real failure.
        const bare = await jget(`${FB_GRAPH}/${id}?fields=shares&access_token=${tok}`);
        if (bare?.error) throw new Error(j.error.message ?? 'Could not read post.');
        return {
          ...ZERO,
          shares: num(bare?.shares?.count),
          note: 'Reaction/comment counts need the pages_read_user_content permission on this login.',
        };
      }
      const mine = String(j?.reactions?.summary?.viewer_reaction ?? 'NONE').toUpperCase() !== 'NONE' ? 1 : 0;
      return {
        ...ZERO,
        likes: Math.max(0, num(j?.reactions?.summary?.total_count) - mine),
        comments: num(j?.comments?.summary?.total_count),
        shares: num(j?.shares?.count),
        note,
      };
    }
    case 'instagram': {
      const tok = encodeURIComponent(await accessToken(c, t));
      const j = await jget(`${IG_GRAPH}/${encodeURIComponent(remoteId)}?fields=like_count,comments_count&access_token=${tok}`);
      if (j?.error) throw new Error(j.error.message ?? 'Could not read post.');
      // Saves and shares sit behind instagram_business_manage_insights, which
      // we deliberately do not request (src/utils/metaConfig.ts, and the
      // privacy policy says so), so Instagram reports likes and comments only.
      return { ...ZERO, likes: num(j.like_count), comments: num(j.comments_count) };
    }
    case 'threads': {
      // Engagement lives on the media insights edge (threads_manage_insights),
      // not as fields on the media object.
      const tok = await accessToken(c, t);
      const enc = encodeURIComponent(tok);
      const j = await jget(
        `${THREADS_API}/v1.0/${encodeURIComponent(remoteId)}/insights?metric=views,likes,replies,reposts,quotes&access_token=${enc}`,
        { Authorization: `Bearer ${tok}` },
      );
      if (j?.error) throw new Error(j.error.message ?? 'Could not read post.');
      const m = threadsMetrics(j);
      return {
        ...ZERO,
        likes: num(m.likes),
        comments: num(m.replies),
        views: m.views === undefined ? null : num(m.views),
        shares: num(m.reposts) + num(m.quotes),
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
        ...ZERO,
        likes: num(pm.like_count),
        comments: num(pm.reply_count),
        views: num(pm.impression_count) || null,
        shares: num(pm.retweet_count) + num(pm.quote_count),
        saves: num(pm.bookmark_count),
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
      // viewer.like / viewer.repost are set when WE liked or reposted our own post.
      return {
        ...ZERO,
        likes: Math.max(0, num(p.likeCount) - (p.viewer?.like ? 1 : 0)),
        comments: num(p.replyCount),
        shares: Math.max(0, num(p.repostCount) - (p.viewer?.repost ? 1 : 0)) + num(p.quoteCount),
      };
    }
    case 'mastodon': {
      const token = await accessToken(c, t);
      const base = String(c.instance_url ?? '').replace(/\/+$/, '');
      if (!base) throw new Error('Mastodon channel missing its instance URL.');
      const j = await jget(`${base}/api/v1/statuses/${encodeURIComponent(remoteId)}`, {
        Authorization: `Bearer ${token}`,
      });
      if (!j?.id) throw new Error('Could not read post.');
      // favourited / reblogged describe the authenticated account, i.e. us.
      // quotes_count (Mastodon 4.3+) rides inside shares; older instances omit
      // it, which reads as 0.
      return {
        ...ZERO,
        likes: Math.max(0, num(j.favourites_count) - (j.favourited ? 1 : 0)),
        comments: num(j.replies_count),
        shares:
          Math.max(0, num(j.reblogs_count) - (j.reblogged ? 1 : 0)) + num(j.quotes_count),
      };
    }
    case 'youtube': {
      const token = await accessToken(c, t);
      const j = await jget(`${YT_API}/videos?part=statistics&id=${encodeURIComponent(remoteId)}`, {
        Authorization: `Bearer ${token}`,
      });
      const s = Array.isArray(j?.items) ? j.items[0]?.statistics : undefined;
      if (!s) throw new Error('Could not read video.');
      // A like from the channel itself is not audience engagement.
      const r = await jget(`${YT_API}/videos/getRating?id=${encodeURIComponent(remoteId)}`, {
        Authorization: `Bearer ${token}`,
      }).catch(() => null);
      const mine = r?.items?.[0]?.rating === 'like' ? 1 : 0;
      return {
        ...ZERO,
        likes: Math.max(0, num(s.likeCount) - mine),
        comments: num(s.commentCount),
        views: num(s.viewCount) || null,
      };
    }
    case 'linkedin': {
      if (!remoteId.startsWith('urn:li:')) {
        return { ...ZERO, note: 'No LinkedIn post id was saved, republish to track this post.' };
      }
      const token = await accessToken(c, t);
      const j = await jget(`${LI_API}/rest/socialActions/${encodeURIComponent(remoteId)}`, {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      });
      if (typeof j?.status === 'number' && j.status >= 400) {
        if (j.status === 401 || j.status === 403) {
          return { ...ZERO, note: 'LinkedIn read permission not granted, reconnect LinkedIn, then retry.' };
        }
        throw new Error(j?.message ?? 'Could not read post.');
      }
      return {
        ...ZERO,
        likes: Math.max(0, num(j?.likesSummary?.totalLikes) - (j?.likesSummary?.likedByCurrentUser ? 1 : 0)),
        comments: num(j?.commentsSummary?.totalComments),
      };
    }
    case 'pinterest': {
      const token = pinContentToken(await accessToken(c, t));
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86400000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const j = await jget(
        `${pinContentApi()}/pins/${encodeURIComponent(remoteId)}/analytics` +
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
        ...ZERO,
        saves: sumMetric(['SAVE']),
        clicks: sumMetric(['PIN_CLICK', 'OUTBOUND_CLICK']),
        views: impressions || null,
        note: 'Pinterest reports saves and clicks; it exposes no like or comment API.',
      };
    }
    case 'gmb': {
      // Google Business Profile local posts have NO per-post metrics API -
      // the location-level Performance & Performance Images APIs are the
      // only surfaces. Both attach to the LOCATION (external_id), not the
      // post, so the numbers land once per location rather than per post;
      // the same totals repeat across that location's posts with a note.
      const token = await accessToken(c, t);
      const parent = String(c.external_id ?? '');
      if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(parent)) {
        throw new Error('GBP location missing, reconnect the channel.');
      }
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86400000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      let callToActions = 0;
      let views = 0;
      let note = '';
      try {
        const j = await jget(
          `${GMB_PERF}/${parent}:fetchMultiDailyMetricsTimeSeries` +
            `?dailyMetrics=CALL_CLICKS&dailyMetrics=WEBSITE_CLICKS&dailyMetrics=BOOKING_CLICKS` +
            `&daily_range.start_date.year=${start.getFullYear()}` +
            `&daily_range.start_date.month=${start.getMonth() + 1}` +
            `&daily_range.start_date.day=${start.getDate()}` +
            `&daily_range.end_date.year=${end.getFullYear()}` +
            `&daily_range.end_date.month=${end.getMonth() + 1}` +
            `&daily_range.end_date.day=${end.getDate()}`,
          { Authorization: `Bearer ${token}` },
        );
        const series = Array.isArray(j?.multiDailyMetricsTimeSeries) ? j.multiDailyMetricsTimeSeries : [];
        for (const s of series) {
          for (const pt of s?.dailyMetricEntities ?? []) {
            callToActions += num(pt?.value?.metricValue?.totalInteractionCount ?? pt?.value?.totalInteractionCount);
          }
        }
      } catch (e: any) {
        note = String(e?.message ?? '').slice(0, 120);
      }
      try {
        const media = await jget(
          `${GMB_PERF}/${parent}:fetchMultiDailyMetricsTimeSeries` +
            `?dailyMetrics=PHOTO_COUNT&daily_range.start_date.year=${start.getFullYear()}` +
            `&daily_range.start_date.month=${start.getMonth() + 1}` +
            `&daily_range.start_date.day=${start.getDate()}` +
            `&daily_range.end_date.year=${end.getFullYear()}` +
            `&daily_range.end_date.month=${end.getMonth() + 1}` +
            `&daily_range.end_date.day=${end.getDate()}`,
          { Authorization: `Bearer ${token}` },
        );
        const series = Array.isArray(media?.multiDailyMetricsTimeSeries) ? media.multiDailyMetricsTimeSeries : [];
        for (const s of series) {
          for (const pt of s?.dailyMetricEntities ?? []) {
            views += num(pt?.value?.metricValue?.totalInteractionCount ?? pt?.value?.totalInteractionCount);
          }
        }
      } catch {
        /* photo metric optional */
      }
      return {
        ...ZERO,
        views: views || null,
        clicks: callToActions,
        note:
          note ||
          'Location-level metrics (clicks + photo views, last 30d) repeat across this profile\u2019s posts, GBP exposes no per-post stats.',
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
  sent_at?: string | null;
  posts?: { chain_id: string | null; chain_position: number | null } | null;
  /** One-to-one embed; older PostgREST returns it as a one-row array. */
  post_stats?: { fetched_at: string | null } | { fetched_at: string | null }[] | null;
}

const lastFetched = (tg: TargetRow): string | null => {
  const s = Array.isArray(tg.post_stats) ? tg.post_stats[0] : tg.post_stats;
  return s?.fetched_at ?? null;
};

/**
 * Public metrics for many X posts in one call per 100 ids. Posts X leaves
 * out (deleted) are simply missing; `problem` carries X's reason when the
 * whole read failed, so the per-post error says something useful.
 */
async function xMetrics(c: ChannelRow, t: TokenRow, targets: TargetRow[]): Promise<Map<string, Stats> & { problem?: string }> {
  const out: Map<string, Stats> & { problem?: string } = new Map();
  const ids = [...new Set(targets.map((tg) => String(tg.remote_id ?? '').split(',')[0].trim()).filter(Boolean))];
  try {
    const token = await accessToken(c, t);
    for (let i = 0; i < ids.length; i += 100) {
      const r = await fetch(
        `${X_API}/tweets?ids=${ids.slice(i, i + 100).join(',')}&tweet.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const j: any = await r.json().catch(() => ({}));
      noteResponse(r.status, r.headers, j);
      if (!r.ok) {
        out.problem = `X ${r.status}: ${j?.detail ?? j?.title ?? 'post read failed'}`;
        break;
      }
      for (const d of j?.data ?? []) {
        const pm = d?.public_metrics;
        if (!pm) continue;
        out.set(String(d.id), {
          ...ZERO,
          likes: num(pm.like_count),
          comments: num(pm.reply_count),
          views: num(pm.impression_count) || null,
          shares: num(pm.retweet_count) + num(pm.quote_count),
          saves: num(pm.bookmark_count),
        });
      }
    }
  } catch (e: any) {
    out.problem = String(e?.message ?? e).slice(0, 160);
  }
  return out;
}

/**
 * YouTube statistics for many videos in one call per 50 ids, plus one
 * getRating call for our own likes: 2 quota units for the batch instead of
 * 2 per video.
 */
async function youtubeMetrics(c: ChannelRow, t: TokenRow, targets: TargetRow[]): Promise<Map<string, Stats> & { problem?: string }> {
  const out: Map<string, Stats> & { problem?: string } = new Map();
  const ids = [...new Set(targets.map((tg) => String(tg.remote_id ?? '').split(',')[0].trim()).filter(Boolean))];
  try {
    const auth = { Authorization: `Bearer ${await accessToken(c, t)}` };
    for (let i = 0; i < ids.length; i += 50) {
      const list = encodeURIComponent(ids.slice(i, i + 50).join(','));
      const [vs, ratings] = await Promise.all([
        jget(`${YT_API}/videos?part=statistics&id=${list}`, auth),
        jget(`${YT_API}/videos/getRating?id=${list}`, auth).catch(() => null),
      ]);
      if (!Array.isArray(vs?.items)) {
        out.problem = vs?.error?.message ?? 'Could not read video.';
        break;
      }
      // A like from the channel itself is not audience engagement.
      const liked = new Set<string>(
        (ratings?.items ?? []).filter((r: any) => r?.rating === 'like').map((r: any) => String(r.videoId)),
      );
      for (const v of vs.items) {
        const s = v?.statistics ?? {};
        const id = String(v?.id ?? '');
        out.set(id, {
          ...ZERO,
          likes: Math.max(0, num(s.likeCount) - (liked.has(id) ? 1 : 0)),
          comments: num(s.commentCount),
          views: num(s.viewCount) || null,
        });
      }
    }
  } catch (e: any) {
    out.problem = String(e?.message ?? e).slice(0, 160);
  }
  return out;
}

/** Platforms whose reply count covers direct replies only; the rest
 *  (Instagram, Facebook stream, YouTube, LinkedIn) count the whole tree. */
export const DIRECT_REPLY_COUNTS = new Set(['x', 'bluesky', 'mastodon', 'threads']);

const inList = (ids: string[]): string =>
  encodeURIComponent(`(${ids.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(',')})`);

/**
 * How many of a post's counted comments are OURS: replies we sent from the
 * inbox or auto-replies (stored by the comment sync with is_own), plus the
 * next part of a thread we published, which the platform counts as a reply
 * to the part before it. Those are our actions, not audience engagement.
 */
async function ownReplies(c: ChannelRow, target: TargetRow, remoteId: string): Promise<number> {
  const full = String(target.remote_id ?? '').trim();
  const postIds = [...new Set([full, remoteId].filter(Boolean))];
  const own = new Set<string>();
  const direct = DIRECT_REPLY_COUNTS.has(c.provider);
  const rows = await rest<{ external_id: string; parent_external_id: string | null }[]>(
    `/rest/v1/comments?channel_id=eq.${encodeURIComponent(c.id)}&is_own=is.true&status=neq.deleted` +
      `&external_post_id=in.${inList(postIds)}&select=external_id,parent_external_id`,
  ).catch(() => []);
  for (const r of rows ?? []) {
    // A direct-reply count never included our replies nested under a commenter.
    if (direct && r.parent_external_id && r.parent_external_id !== remoteId) continue;
    own.add(String(r.external_id));
  }
  const chain = target.posts;
  if (direct && chain?.chain_id) {
    const next = await rest<{ remote_id: string | null }[]>(
      `/rest/v1/post_targets?channel_id=eq.${encodeURIComponent(c.id)}&status=eq.sent&remote_id=not.is.null` +
        `&select=remote_id,posts!inner(chain_id,chain_position)` +
        `&posts.chain_id=eq.${encodeURIComponent(chain.chain_id)}` +
        `&posts.chain_position=eq.${(chain.chain_position ?? 0) + 1}&limit=1`,
    ).catch(() => []);
    const id = String(next?.[0]?.remote_id ?? '').split(',')[0].trim();
    if (id) own.add(id);
  }
  return own.size;
}

/**
 * Followers-only snapshot (hourly sweep + "refresh" on the analytics screens):
 * one profile read, no per-post reads. Never throws, a miss just leaves the
 * previous snapshot in place so a flaky provider can't spin the retry loop.
 */
export async function snapshotChannelFollowers(channelId: string): Promise<{ ok: boolean; skipped: string | null }> {
  const got = await getChannel(channelId);
  if (!got) return { ok: false, skipped: 'channel gone' };
  const { c, t } = got;
  if (c.status !== 'connected') return { ok: false, skipped: `channel ${c.status}` };
  if (inBackoff(c.api_backoff_until)) return { ok: false, skipped: `API backoff until ${c.api_backoff_until}` };
  try {
    await snapshotFollowers(c, t);
    return { ok: true, skipped: null };
  } catch (e: any) {
    warn(`followers ${c.provider}/${c.external_id}: ${String(e?.message ?? e).slice(0, 160)}`);
    return { ok: false, skipped: null };
  }
}

/** Set once post_stats turns out to predate p119 (no saves/clicks columns). */
let legacyStatsColumns = false;

/**
 * Upsert one post_stats row. If the worker ships before migration p119 adds
 * saves and clicks, PostgREST rejects the unknown columns; write the row
 * without them instead of failing every snapshot until the migration runs.
 */
export async function writeStats(row: Record<string, unknown>): Promise<void> {
  const send = (body: Record<string, unknown>) =>
    rest('/rest/v1/post_stats', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
  const { saves, clicks, ...legacy } = row;
  if (legacyStatsColumns) return void (await send(legacy));
  try {
    await send(row);
  } catch (e: any) {
    if (!/PGRST204|saves|clicks/.test(String(e?.message ?? ''))) throw e;
    legacyStatsColumns = true;
    warn('post_stats has no saves/clicks columns yet (migration p119), writing without them');
    await send(legacy);
  }
}

/** `fresh`: targets the own-posts pass just refreshed from its post list;
 *  reading them again one by one would spend API calls for the same numbers. */
export async function snapshotChannel(
  channelId: string,
  fresh: Set<string> = new Set(),
): Promise<{ updated: number; failed: number; skipped: string | null }> {
  const got = await getChannel(channelId);
  if (!got) return { updated: 0, failed: 0, skipped: 'channel gone' };
  const { c, t } = got;
  if (c.status !== 'connected') return { updated: 0, failed: 0, skipped: `channel ${c.status}` };
  if (inBackoff(c.api_backoff_until)) return { updated: 0, failed: 0, skipped: `API backoff until ${c.api_backoff_until}` };

  // Follower/profile snapshot first, independent of post history, so brand
  // new channels and post-read-less providers (TikTok) still report audience.
  try {
    await snapshotFollowers(c, t);
  } catch (e: any) {
    warn(`followers ${c.provider}/${c.external_id}: ${String(e?.message ?? e).slice(0, 160)}`);
  }

  if (c.provider === 'tiktok') {
    // TikTok has no post-read API, skip with a clean no-op (mobile shows zeros).
    return { updated: 0, failed: 0, skipped: 'tiktok has no post stats API' };
  }

  const now = Date.now();
  const since = new Date(now - STATS_MAX_AGE).toISOString();
  const targets = await rest<TargetRow[]>(
    `/rest/v1/post_targets?channel_id=eq.${encodeURIComponent(c.id)}` +
      `&status=eq.sent&remote_id=not.is.null` +
      `&select=id,post_id,remote_id,provider,sent_at,posts(chain_id,chain_position),post_stats(fetched_at)` +
      // Older posts are never read one by one (cadence.ts); undated old rows
      // still get their daily read.
      `&or=(sent_at.gte.${encodeURIComponent(`"${since}"`)},sent_at.is.null)` +
      // nullslast: Postgres sorts NULL first on DESC, so targets without a
      // sent_at could crowd real recent posts out of the window.
      `&order=sent_at.desc.nullslast&limit=${MAX_TARGETS}`,
  );
  if (!targets?.length) return { updated: 0, failed: 0, skipped: 'no sent posts in the last 30 days' };

  let updated = 0;
  let failed = 0;
  // Read only what is due by age: every tick under 48 hours, then daily,
  // then weekly (cadence.ts). This used to re-read the 30 newest posts on
  // every tick, however old.
  const due = targets.filter((tg) => !fresh.has(tg.id) && statsDue(tg.sent_at, lastFetched(tg), now));
  // X and YouTube: one batched lookup (100 / 50 ids) instead of a read per
  // post. Per-post X reads tripped the per-endpoint rate limit.
  const batch =
    !due.length ? null
    : c.provider === 'x' ? await xMetrics(c, t, due)
    : c.provider === 'youtube' ? await youtubeMetrics(c, t, due)
    : null;
  for (const target of due) {
    // A usage header said the window is nearly full: stop spending calls.
    if (!batch && budgetSpent()) break;
    const remoteId = String(target.remote_id ?? '').split(',')[0].trim();
    if (!remoteId) continue;
    try {
      const s = batch ? batch.get(remoteId) : await statsFor(c, t, remoteId);
      if (!s) throw new Error(batch?.problem ?? 'Could not read post.');
      s.comments = Math.max(0, s.comments - (await ownReplies(c, target, remoteId)));
      await writeStats({
        post_target_id: target.id,
        workspace_id: c.workspace_id,
        post_id: target.post_id,
        channel_id: c.id,
        provider: c.provider,
        likes: s.likes,
        comments: s.comments,
        shares: s.shares,
        saves: s.saves,
        clicks: s.clicks,
        views: s.views,
        note: s.note ?? null,
        fetched_at: new Date().toISOString(),
      });
      updated += 1;
    } catch (e: any) {
      failed += 1;
      warn(`stats ${c.provider}/${c.external_id} target ${target.id}: ${String(e?.message ?? e).slice(0, 160)}`);
    }
  }
  info(`snapshot ${c.provider}/${c.external_id}: ${updated} updated, ${failed} failed, ${targets.length - due.length} not due`);
  // Only a total failure is a job failure, a systematic breakage (expired
  // token, API change) should back off and retry.
  if (updated === 0 && failed > 0) {
    throw new Error(`all ${failed} stat reads failed for ${c.provider}/${c.external_id}`);
  }
  return { updated, failed, skipped: null };
}
