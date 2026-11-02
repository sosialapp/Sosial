/**
 * Analytics for posts made directly on the platform (p120 channel_posts).
 *
 * post_stats only covers what Sosial published. This lists each connected
 * account's own recent posts, Sosial's or not, with the same audience-only
 * numbers as stats.ts (our own replies and, where the API says so, our own
 * likes/reposts come off), and upserts the latest snapshot per post. A post
 * Sosial published is matched on its saved remote_id and keeps post_target_id,
 * so analytics counts it once (through post_stats) and only adds the rest.
 *
 * Runs with every full analytics snapshot (daily + on-demand, at most hourly
 * per channel). Never throws: a provider that refuses just leaves the
 * previous rows in place.
 *
 * X is left out on purpose: reading an account's own timeline is billed per
 * read on X's API. LinkedIn and Google Business have no per-post list here.
 */
import { rest } from './db';
import { pinContentApi, pinContentToken } from './pinterest';
import { info, warn } from './logger';
import type { ChannelRow, TokenRow } from './avatars';
import {
  DIRECT_REPLY_COUNTS,
  FB_GRAPH,
  IG_GRAPH,
  THREADS_API,
  YT_API,
  accessToken,
  blueskySession,
  bskyApi,
  getChannel,
  jget,
  num,
  statsFor,
  writeStats,
} from './stats';

/** How many recent posts one run reads per account. */
const LIMIT = 50;
/** Providers that need one extra call per post for numbers get fewer. */
const PER_POST_LIMIT = 20;
/** Pinterest trial apps get ~1,000 calls a day; keep its share small. */
const PIN_LIMIT = 10;

interface OwnPost {
  externalId: string;
  /** Other ids the same post goes by (a Facebook video post's video id). */
  aliases?: string[];
  url: string | null;
  body: string | null;
  thumbnail: string | null;
  mediaKind: string | null;
  postedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  views: number | null;
  note?: string | null;
}

const text = (v: unknown, max = 280): string | null => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s ? s.slice(0, max) : null;
};
const iso = (v: unknown): string | null => {
  if (typeof v === 'number') return new Date(v * 1000).toISOString();
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const kind = (v: unknown): string | null => {
  const s = String(v ?? '').toLowerCase();
  if (!s) return null;
  if (s.includes('video') || s.includes('reel')) return 'video';
  if (s.includes('carousel') || s.includes('album')) return 'carousel';
  if (s.includes('image') || s.includes('photo')) return 'image';
  return 'text';
};
const plain = (html: unknown): string => String(html ?? '').replace(/<[^>]+>/g, ' ');

/* ------------------------------ per provider ------------------------------ */

async function facebookPosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const tok = encodeURIComponent(await accessToken(c, t));
  const fields = [
    'id',
    'message',
    'permalink_url',
    'created_time',
    'full_picture',
    'shares',
    // viewer_reaction is the Page's own reaction (we read with its token).
    'reactions.summary(total_count,viewer_reaction).limit(0)',
    // filter=stream counts replies too, matching the comment sync.
    'comments.filter(stream).summary(total_count).limit(0)',
    'attachments{media_type,target{id}}',
  ].join(',');
  const j = await jget(
    `${FB_GRAPH}/${encodeURIComponent(c.external_id)}/posts?fields=${encodeURIComponent(fields)}&limit=${LIMIT}&access_token=${tok}`,
  );
  if (j?.error) throw new Error(j.error.message ?? 'facebook posts read failed');
  return (Array.isArray(j?.data) ? j.data : []).map((p: any): OwnPost => {
    const att = p?.attachments?.data?.[0];
    const mine = String(p?.reactions?.summary?.viewer_reaction ?? 'NONE').toUpperCase() !== 'NONE' ? 1 : 0;
    // Sosial saves a video post under the video's id; the attachment target
    // is that id, so the match still finds it.
    const targetId = att?.target?.id ? String(att.target.id) : null;
    return {
      externalId: String(p.id),
      aliases: targetId ? [targetId] : [],
      url: p?.permalink_url ?? null,
      body: text(p?.message),
      thumbnail: p?.full_picture ?? null,
      mediaKind: kind(att?.media_type) ?? (p?.full_picture ? 'image' : 'text'),
      postedAt: iso(p?.created_time),
      likes: Math.max(0, num(p?.reactions?.summary?.total_count) - mine),
      comments: num(p?.comments?.summary?.total_count),
      shares: num(p?.shares?.count),
      saves: 0,
      clicks: 0,
      views: null,
    };
  });
}

async function instagramPosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const tok = encodeURIComponent(await accessToken(c, t));
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
  const j = await jget(`${IG_GRAPH}/me/media?fields=${fields}&limit=${LIMIT}&access_token=${tok}`);
  if (j?.error) throw new Error(j.error.message ?? 'instagram media read failed');
  return (Array.isArray(j?.data) ? j.data : []).map((m: any): OwnPost => ({
    externalId: String(m.id),
    url: m?.permalink ?? null,
    body: text(m?.caption),
    thumbnail: m?.thumbnail_url ?? m?.media_url ?? null,
    mediaKind: kind(m?.media_type),
    postedAt: iso(m?.timestamp),
    // Saves and shares need the insights permission we deliberately skip.
    likes: num(m?.like_count),
    comments: num(m?.comments_count),
    shares: 0,
    saves: 0,
    clicks: 0,
    views: null,
  }));
}

async function threadsPosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const tok = await accessToken(c, t);
  const fields = 'id,text,permalink,timestamp,media_type,media_url,thumbnail_url';
  const j = await jget(
    `${THREADS_API}/v1.0/me/threads?fields=${fields}&limit=${PER_POST_LIMIT}&access_token=${encodeURIComponent(tok)}`,
    { Authorization: `Bearer ${tok}` },
  );
  if (j?.error) throw new Error(j.error.message ?? 'threads posts read failed');
  const out: OwnPost[] = [];
  for (const p of Array.isArray(j?.data) ? j.data : []) {
    // Numbers live on the per-post insights edge, same read as stats.ts.
    const s = await statsFor(c, t, String(p.id)).catch(() => null);
    out.push({
      externalId: String(p.id),
      url: p?.permalink ?? null,
      body: text(p?.text),
      thumbnail: p?.thumbnail_url ?? p?.media_url ?? null,
      mediaKind: kind(p?.media_type),
      postedAt: iso(p?.timestamp),
      likes: s?.likes ?? 0,
      comments: s?.comments ?? 0,
      shares: s?.shares ?? 0,
      saves: 0,
      clicks: 0,
      views: s?.views ?? null,
      note: s ? null : 'Threads did not return insights for this post.',
    });
  }
  return out;
}

async function blueskyPosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const { token, pdsHost } = await blueskySession(c, t);
  const j = await jget(
    `${bskyApi(pdsHost)}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(c.external_id)}&filter=posts_no_replies&limit=${LIMIT}`,
    { Authorization: `Bearer ${token}` },
  );
  if (!Array.isArray(j?.feed)) throw new Error(j?.message ?? 'bluesky feed read failed');
  return j.feed
    .filter((it: any) => it?.post?.uri && !it?.reason)
    .map((it: any): OwnPost => {
      const p = it.post;
      const embed = p?.embed ?? null;
      const thumb =
        embed?.images?.[0]?.thumb ?? embed?.media?.images?.[0]?.thumb ?? embed?.thumbnail ?? embed?.external?.thumb ?? null;
      const handle = String(p?.author?.handle ?? '');
      const rkey = String(p.uri).split('/').pop() ?? '';
      return {
        externalId: String(p.uri),
        url: handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : null,
        body: text(p?.record?.text),
        thumbnail: thumb,
        mediaKind: embed?.playlist || embed?.media?.playlist ? 'video' : thumb ? 'image' : 'text',
        postedAt: iso(p?.record?.createdAt ?? p?.indexedAt),
        // viewer.like / viewer.repost are set when WE liked or reposted it.
        likes: Math.max(0, num(p.likeCount) - (p.viewer?.like ? 1 : 0)),
        comments: num(p.replyCount),
        shares: Math.max(0, num(p.repostCount) - (p.viewer?.repost ? 1 : 0)) + num(p.quoteCount),
        saves: 0,
        clicks: 0,
        views: null,
      };
    });
}

async function mastodonPosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const token = await accessToken(c, t);
  const raw = String(c.instance_url ?? '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error('mastodon instance missing');
  const base = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  const j = await jget(
    `${base}/api/v1/accounts/${encodeURIComponent(c.external_id)}/statuses?limit=40&exclude_replies=true&exclude_reblogs=true`,
    { Authorization: `Bearer ${token}` },
  );
  if (!Array.isArray(j)) throw new Error(j?.error ?? 'mastodon statuses read failed');
  return j
    .filter((s: any) => s?.id && !s?.reblog)
    .map((s: any): OwnPost => {
      const media = Array.isArray(s?.media_attachments) ? s.media_attachments : [];
      const first = media.find((m: any) => m?.preview_url || m?.url);
      return {
        externalId: String(s.id),
        url: s?.url ?? null,
        body: text(plain(s?.content)),
        thumbnail: first?.preview_url ?? first?.url ?? null,
        mediaKind: first ? kind(first?.type) : 'text',
        postedAt: iso(s?.created_at),
        // favourited / reblogged describe the authenticated account, i.e. us.
        likes: Math.max(0, num(s.favourites_count) - (s.favourited ? 1 : 0)),
        comments: num(s.replies_count),
        shares: Math.max(0, num(s.reblogs_count) - (s.reblogged ? 1 : 0)) + num(s.quotes_count),
        saves: 0,
        clicks: 0,
        views: null,
      };
    });
}

async function youtubePosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const token = await accessToken(c, t);
  const auth = { Authorization: `Bearer ${token}` };
  const ch = await jget(`${YT_API}/channels?part=contentDetails&mine=true`, auth);
  const uploads = String(ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? '');
  if (!uploads) throw new Error(ch?.error?.message ?? 'youtube uploads playlist not found');
  const pl = await jget(
    `${YT_API}/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=${LIMIT}`,
    auth,
  );
  const items = Array.isArray(pl?.items) ? pl.items : [];
  const ids = items.map((it: any) => String(it?.contentDetails?.videoId ?? '')).filter(Boolean);
  if (!ids.length) return [];
  const idList = encodeURIComponent(ids.join(','));
  const [vs, ratings] = await Promise.all([
    jget(`${YT_API}/videos?part=statistics&id=${idList}`, auth),
    jget(`${YT_API}/videos/getRating?id=${idList}`, auth).catch(() => null),
  ]);
  const stats = new Map<string, any>((vs?.items ?? []).map((v: any) => [String(v.id), v.statistics]));
  // A like from the channel itself is not audience engagement.
  const liked = new Set<string>(
    (ratings?.items ?? []).filter((r: any) => r?.rating === 'like').map((r: any) => String(r.videoId)),
  );
  return items
    .filter((it: any) => it?.contentDetails?.videoId)
    .map((it: any): OwnPost => {
      const id = String(it.contentDetails.videoId);
      const s = stats.get(id) ?? {};
      const sn = it?.snippet ?? {};
      return {
        externalId: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        body: text(sn?.title),
        thumbnail: sn?.thumbnails?.medium?.url ?? sn?.thumbnails?.default?.url ?? null,
        mediaKind: 'video',
        postedAt: iso(it?.contentDetails?.videoPublishedAt ?? sn?.publishedAt),
        likes: Math.max(0, num(s.likeCount) - (liked.has(id) ? 1 : 0)),
        comments: num(s.commentCount),
        shares: 0,
        saves: 0,
        clicks: 0,
        views: num(s.viewCount) || null,
      };
    });
}

/** TikTok: the video list carries the numbers. Sosial saves TikTok's
 *  publish_id, not the video id, so these never match a Sosial post; Sosial
 *  has no post_stats for TikTok either, so nothing is counted twice. */
async function tiktokPosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const token = await accessToken(c, t);
  const fields = 'id,title,video_description,create_time,cover_image_url,share_url,like_count,comment_count,share_count,view_count';
  const out: OwnPost[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < 2; page++) {
    const r = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${fields}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (j?.error?.code && j.error.code !== 'ok') throw new Error(j.error.message ?? 'tiktok video list failed');
    for (const v of j?.data?.videos ?? []) {
      out.push({
        externalId: String(v.id),
        url: v?.share_url ?? null,
        body: text(v?.title || v?.video_description),
        thumbnail: v?.cover_image_url ?? null,
        mediaKind: 'video',
        postedAt: iso(v?.create_time),
        likes: num(v?.like_count),
        comments: num(v?.comment_count),
        shares: num(v?.share_count),
        saves: 0,
        clicks: 0,
        views: num(v?.view_count) || null,
      });
    }
    if (!j?.data?.has_more || !j?.data?.cursor) break;
    cursor = Number(j.data.cursor);
  }
  return out;
}

async function pinterestPosts(c: ChannelRow, t: TokenRow): Promise<OwnPost[]> {
  const token = pinContentToken(await accessToken(c, t));
  const j = await jget(`${pinContentApi()}/pins?page_size=${PIN_LIMIT}`, { Authorization: `Bearer ${token}` });
  if (!Array.isArray(j?.items)) throw new Error(j?.message ?? 'pinterest pins read failed');
  const out: OwnPost[] = [];
  for (const p of j.items) {
    // Same 30-day pin analytics read as stats.ts (saves, clicks, impressions).
    const s = await statsFor(c, t, String(p.id)).catch(() => null);
    const images = p?.media?.images ?? {};
    out.push({
      externalId: String(p.id),
      url: p?.id ? `https://www.pinterest.com/pin/${p.id}/` : null,
      body: text(p?.title || p?.description),
      thumbnail: images['400x300']?.url ?? images['150x150']?.url ?? null,
      mediaKind: kind(p?.media?.media_type) ?? 'image',
      postedAt: iso(p?.created_at),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: s?.saves ?? 0,
      clicks: s?.clicks ?? 0,
      views: s?.views ?? null,
      note: s?.note ?? null,
    });
  }
  return out;
}

const READERS: Record<string, (c: ChannelRow, t: TokenRow) => Promise<OwnPost[]>> = {
  facebook: facebookPosts,
  instagram: instagramPosts,
  threads: threadsPosts,
  bluesky: blueskyPosts,
  mastodon: mastodonPosts,
  youtube: youtubePosts,
  tiktok: tiktokPosts,
  pinterest: pinterestPosts,
};

/* ------------------------------ the job ------------------------------ */

interface SosialTarget {
  id: string;
  post_id: string;
}

/** remote_id (and each comma-joined part) → the Sosial target that owns it. */
async function sosialTargets(channelId: string): Promise<Map<string, SosialTarget>> {
  const rows = await rest<{ id: string; post_id: string; remote_id: string | null }[]>(
    `/rest/v1/post_targets?channel_id=eq.${encodeURIComponent(channelId)}&remote_id=not.is.null&select=id,post_id,remote_id&limit=1000`,
  ).catch(() => []);
  const map = new Map<string, SosialTarget>();
  for (const r of rows ?? []) {
    const full = String(r.remote_id ?? '').trim();
    if (!full) continue;
    const target = { id: r.id, post_id: r.post_id };
    map.set(full, target);
    for (const part of full.split(',')) if (part.trim()) map.set(part.trim(), target);
  }
  return map;
}

/** Our own replies per post, from the comment sync (is_own rows). Direct-reply
 *  platforms only count replies to the post itself. */
async function ownRepliesByPost(c: ChannelRow): Promise<Map<string, number>> {
  const rows = await rest<{ external_post_id: string | null; parent_external_id: string | null }[]>(
    `/rest/v1/comments?channel_id=eq.${encodeURIComponent(c.id)}&is_own=is.true&status=neq.deleted` +
      `&select=external_post_id,parent_external_id&limit=5000`,
  ).catch(() => []);
  const direct = DIRECT_REPLY_COUNTS.has(c.provider);
  const out = new Map<string, number>();
  for (const r of rows ?? []) {
    const post = String(r.external_post_id ?? '');
    if (!post) continue;
    if (direct && r.parent_external_id && r.parent_external_id !== post) continue;
    out.set(post, (out.get(post) ?? 0) + 1);
  }
  return out;
}

export async function snapshotOwnPosts(
  channelId: string,
): Promise<{ saved: number; skipped: string | null; fresh: Set<string> }> {
  const fresh = new Set<string>();
  try {
    const got = await getChannel(channelId);
    if (!got) return { saved: 0, skipped: 'channel gone', fresh };
    const { c, t } = got;
    if (c.status !== 'connected') return { saved: 0, skipped: `channel ${c.status}`, fresh };
    const read = READERS[c.provider];
    if (!read) return { saved: 0, skipped: `${c.provider} has no own-posts read`, fresh };

    const [posts, targets, own] = await Promise.all([read(c, t), sosialTargets(c.id), ownRepliesByPost(c)]);
    if (!posts.length) return { saved: 0, skipped: 'no posts', fresh };

    const now = new Date().toISOString();
    const rows = posts.map((p) => {
      const ids = [p.externalId, ...(p.aliases ?? [])];
      const target = ids.map((id) => targets.get(id)).find(Boolean) ?? null;
      return {
        workspace_id: c.workspace_id,
        channel_id: c.id,
        provider: c.provider,
        external_id: p.externalId,
        post_target_id: target?.id ?? null,
        post_id: target?.post_id ?? null,
        url: p.url,
        body: p.body,
        thumbnail: p.thumbnail,
        media_kind: p.mediaKind,
        posted_at: p.postedAt,
        likes: p.likes,
        comments: Math.max(0, p.comments - (own.get(p.externalId) ?? 0)),
        shares: p.shares,
        saves: p.saves,
        clicks: p.clicks,
        views: p.views,
        note: p.note ?? null,
        fetched_at: now,
      };
    });
    await rest('/rest/v1/channel_posts?on_conflict=channel_id,external_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.map(({ post_id: _postId, ...row }) => row)),
    });

    // Posts Sosial published: this list reaches the latest 50 in one call,
    // while the per-post refresh only re-reads the 30 most recent targets. A
    // post that went out a while ago and then took off (an 890-like Facebook
    // post) never refreshed. Save the fresh numbers as its post_stats too;
    // the per-post read still runs after this for the newest ones.
    let refreshed = 0;
    for (const r of rows) {
      if (!r.post_target_id || !r.post_id) continue;
      try {
        await writeStats({
          post_target_id: r.post_target_id,
          workspace_id: r.workspace_id,
          post_id: r.post_id,
          channel_id: r.channel_id,
          provider: r.provider,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          saves: r.saves,
          clicks: r.clicks,
          views: r.views,
          note: r.note,
          fetched_at: r.fetched_at,
        });
        refreshed += 1;
        fresh.add(r.post_target_id);
      } catch (e: any) {
        warn(`own posts ${c.provider}/${c.external_id} target ${r.post_target_id}: ${String(e?.message ?? e).slice(0, 120)}`);
      }
    }
    info(`own posts ${c.provider}/${c.external_id}: ${rows.length} saved, ${refreshed} Sosial posts refreshed`);
    return { saved: rows.length, skipped: null, fresh };
  } catch (e: any) {
    // Before migration p120 the table is missing; a provider may refuse. Either
    // way the regular per-post snapshot carries on.
    warn(`own posts ${channelId}: ${String(e?.message ?? e).slice(0, 160)}`);
    return { saved: 0, skipped: 'failed', fresh };
  }
}
