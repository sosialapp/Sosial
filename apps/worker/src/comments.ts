/**
 * Comment scan — keeps platform_comments fresh for the web Community inbox
 * and the bell notifications.
 *
 * For every post_target sent on facebook / threads / instagram, fetch the
 * platform's comment list for the published post and upsert the rows. New
 * comment ids (never seen for this workspace+provider) also drop a row into
 * notifications (kind 'comment') so the bell shows them; the DB trigger
 * path is avoided because the worker knows exactly which ids are new.
 *
 * Facebook: GET /{post-id}/comments?fields=from,message,created_time,like_count
 * Threads:  GET /{post-id}/replies (top-level) — reply counts ride the post
 * Instagram: GET /{ig-media-id}/comments?fields=username,text,timestamp,like_count
 *   (the sent post's remote_id IS the IG media id; the newer IG graph
 *   serves it with instagram_business_basic + instagram_manage_comments).
 * X: recent search conversation_id:{tweet-id} — replies to the published
 *   tweet (paid X API; conversation search). The stored access token rides
 *   the normal proactive refresh cycle; a stale one warns and skips.
 * Mastodon: replies arrive as mention notifications on the publishing
 *   account (type=mention), so the scan reads /api/v1/notifications and
 *   keeps only replies whose status in_reply_to_id is one of our sent
 *   remote_ids; the remote post ids come from the same target list.
 *
 * Job kind 'scan_comments' (cron enqueued), payload {}.
 */
import { rest, readSecret } from './db';
import type { Job } from './db';
import { tokenRow, type ChannelRow, type TokenRow } from './avatars';
import { warn, info, debug } from './logger';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';
const THREADS_API = 'https://graph.threads.net/v1.0';
const IG_GRAPH = 'https://graph.instagram.com/v23.0';
const X_API = 'https://api.x.com/2';

interface TargetRow {
  id: string;
  post_id: string;
  remote_id: string;
  channel_id: string | null;
  provider: string;
  posts?: { workspace_id: string } | null;
  post_created_by: string | null;
}

/** Workspace of the target's post (post_targets itself carries no workspace). */
const wsOf = (t: TargetRow): string => t.posts?.workspace_id ?? '';

interface ChannelRowX extends ChannelRow {
  workspace_id: string;
}

async function tokenOf(ch: ChannelRowX, t: TokenRow): Promise<string> {
  void ch;
  if (!t.access_token_secret_id) throw new Error('token missing');
  const v = await readSecret(t.access_token_secret_id);
  if (!v) throw new Error('token unavailable');
  return v;
}

interface RawComment {
  comment_id: string;
  parent_id: string | null;
  author: string;
  author_avatar: string | null;
  message: string;
  like_count: number | null;
  created_at: string | null;
}

async function fbComments(remoteId: string, token: string): Promise<RawComment[]> {
  const r = await fetch(
    `${FB_GRAPH}/${encodeURIComponent(remoteId)}/comments?fields=id,from{name,picture},message,created_time,like_count&limit=25&access_token=${encodeURIComponent(token)}`,
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `facebook comments ${r.status}`);
  const data = Array.isArray(j?.data) ? j.data : [];
  return data
    .filter((c: any) => c?.id && typeof c.message === 'string')
    .map((c: any) => ({
      comment_id: String(c.id),
      parent_id: null,
      author: String(c?.from?.name ?? 'Facebook user'),
      author_avatar: c?.from?.picture?.data?.url ?? null,
      message: String(c.message),
      like_count: typeof c.like_count === 'number' ? c.like_count : null,
      created_at: typeof c.created_time === 'string' ? c.created_time : null,
    }));
}

async function igComments(remoteId: string, token: string): Promise<RawComment[]> {
  // IG graph: comments on a published media (media id = our remote_id).
  const r = await fetch(
    `${IG_GRAPH}/${encodeURIComponent(remoteId)}/comments?fields=id,username,text,timestamp,like_count&limit=25&access_token=${encodeURIComponent(token)}`,
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `instagram comments ${r.status}`);
  const data = Array.isArray(j?.data) ? j.data : [];
  return data
    .filter((c: any) => c?.id && typeof c.text === 'string')
    .map((c: any) => ({
      comment_id: String(c.id),
      parent_id: null,
      author: c?.username ? `@${c.username}` : 'Instagram user',
      author_avatar: null,
      message: String(c.text),
      like_count: typeof c.like_count === 'number' ? c.like_count : null,
      created_at: typeof c.timestamp === 'string' ? c.timestamp : null,
    }));
}

async function xReplies(remoteId: string, token: string): Promise<RawComment[]> {
  // Replies to a published tweet ride the conversation id, served by recent
  // search (paid X API). Expand authors so the inbox can name them.
  const qs = new URLSearchParams({
    query: `conversation_id:${remoteId} -is:retweet`,
    max_results: '25',
    'tweet.fields': 'created_at,public_metrics,in_reply_to_user_id',
    expansions: 'author_id',
    'user.fields': 'name,username',
  });
  const r = await fetch(`${X_API}/tweets/search/recent?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? j?.title ?? `x replies ${r.status}`);
  const users = new Map<string, any>(
    ((j?.includes?.users ?? []) as any[]).map((u) => [String(u.id), u]),
  );
  const data = Array.isArray(j?.data) ? j.data : [];
  return data
    // The conversation starter carries its own conversation_id, so the
    // search returns the original tweet alongside its replies — drop the
    // root or the published post shows up as a "comment" on itself.
    .filter((c: any) => c?.id && typeof c.text === 'string' && String(c.id) !== remoteId)
    .map((c: any) => {
      const u = users.get(String(c?.author_id ?? ''));
      return {
        comment_id: String(c.id),
        parent_id: null,
        author: u?.username ? `@${u.username}` : 'X user',
        author_avatar: null,
        message: String(c.text),
        like_count: typeof c?.public_metrics?.like_count === 'number' ? c.public_metrics.like_count : null,
        created_at: typeof c.created_at === 'string' ? c.created_at : null,
      };
    });
}

async function mastodonReplies(
  ch: ChannelRowX,
  token: string,
  ourStatusIds: Set<string>,
): Promise<RawComment[]> {
  const base = normalizeBase(ch.instance_url);
  // Mentions notifications cover every reply to our posts (and DM-style
  // mentions, filtered out below). Bounded page, newest first.
  const r = await fetch(`${base}/api/v1/notifications?type=mention&limit=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? `mastodon notifications ${r.status}`);
  const out: RawComment[] = [];
  for (const n of Array.isArray(j) ? j : []) {
    const s = n?.status;
    if (!s?.id || typeof s.content !== 'string') continue;
    // Keep only actual replies to OUR published statuses (a bare mention of
    // the account is not a comment on a Sosial post).
    const parent = String(s.in_reply_to_id ?? '');
    if (!parent || !ourStatusIds.has(parent)) continue;
    out.push({
      comment_id: String(s.id),
      // Replies chain on the parent reply too — record it so nested threads
      // can be replied into the right place.
      parent_id: ourStatusIds.has(String(s.id)) ? null : parent,
      author: s?.account?.acct ? `@${s.account.acct}` : 'Mastodon user',
      author_avatar: s?.account?.avatar ?? null,
      message: String(s.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      like_count: typeof s?.favourites_count === 'number' ? s.favourites_count : null,
      created_at: typeof s.created_at === 'string' ? s.created_at : null,
    });
  }
  return out;
}

function normalizeBase(instanceUrl: string | null): string {
  const host = String(instanceUrl ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .split('/')[0]
    .split('?')[0];
  if (!host || /\s/.test(host)) {
    throw new Error('Mastodon channel missing its instance, toggle cloud publishing off and on in Connect.');
  }
  return `https://${host}`;
}

async function threadsReplies(remoteId: string, token: string): Promise<RawComment[]> {
  // Threads reads replies of a published thread post. /conversation is the
  // flattened top-level + nested list; replied_to carries the immediate
  // parent id so reply chains can reach the inbox. profile_picture_url is
  // available on the same call — free avatars.
  const r = await fetch(
    `${THREADS_API}/${encodeURIComponent(remoteId)}/conversation?fields=id,text,username,profile_picture_url,timestamp,like_count,has_replies,hide_status,replied_to&limit=40`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `threads replies ${r.status}`);
  const data = Array.isArray(j?.data) ? j.data : [];
  return data
    .filter((c: any) => c?.id && typeof c.text === 'string')
    .map((c: any) => ({
      comment_id: String(c.id),
      // Nested replies carry their immediate parent on replied_to (a reply
      // id); top-level replies come with none (or replied_to = the root).
      parent_id:
        c?.replied_to?.id && String(c.replied_to.id) !== String(remoteId)
          ? String(c.replied_to.id)
          : null,
      author: c?.username ? `@${c.username}` : 'Threads user',
      author_avatar: typeof c.profile_picture_url === 'string' ? c.profile_picture_url : null,
      message: String(c.text),
      like_count: typeof c.like_count === 'number' ? c.like_count : null,
      created_at: typeof c.timestamp === 'string' ? c.timestamp : null,
    }));
}

export async function handleScanComments(_job: Job): Promise<void> {
  // Recent sent targets on comment-capable providers, newest first, cap 100
  // per sweep: enough coverage, bounded work. Mastodon is handled per
  // channel (notifications), the rest per target (per-post reads).
  const targets = await rest<TargetRow[]>(
    `/rest/v1/post_targets?status=eq.sent&provider=in.(facebook,threads,instagram,x,mastodon)` +
      `&remote_id=neq.&select=id,post_id,remote_id,channel_id,provider,posts(workspace_id)` +
      `&order=updated_at.desc&limit=100`,
  ).catch((e) => {
    debug(`scan_comments: target read failed: ${String(e)}`);
    return [] as TargetRow[];
  });
  debug(`scan_comments: ${targets?.length ?? 0} candidate targets`);

  const cache = new Map<string, { ch: ChannelRowX; t: TokenRow; token: string }>();
  let scanned = 0;

  // ---- Mastodon: one notifications read per channel, then map to targets.
  const mastoTargets = (targets ?? []).filter((t) => t.provider === 'mastodon');
  const otherTargets = (targets ?? []).filter((t) => t.provider !== 'mastodon');
  if (mastoTargets.length) {
    const byChannel = new Map<string, TargetRow[]>();
    for (const t of mastoTargets) {
      if (!t.channel_id || !wsOf(t)) continue;
      const list = byChannel.get(t.channel_id) ?? [];
      list.push(t);
      byChannel.set(t.channel_id, list);
    }
    for (const [channelId, chTargets] of byChannel) {
      try {
        let entry = cache.get(channelId);
        if (!entry) {
          const rows = await rest<ChannelRowX[]>(
            `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
              `&select=id,workspace_id,provider,external_id,instance_url,metadata,status,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)&limit=1`,
          );
          const ch = rows?.[0];
          if (!ch) continue;
          entry = { ch, t: tokenRow(ch), token: await tokenOf(ch, tokenRow(ch)) };
          cache.set(channelId, entry);
        }
        if (chProviderDead(entry.ch)) continue;
        // Any of OUR statuses (posts or our own replies) may be the parent.
        const ourIds = new Set(chTargets.map((t) => t.remote_id));
        const list = await mastodonReplies(entry.ch, entry.token, ourIds);
        if (!list.length) continue;
        for (const c of list) {
          // Attribute the comment to the target whose remote_id is the
          // conversation parent (top-level replies only; nested ones carry
          // parent_id and are attributed to the same post via their root).
          const target =
            chTargets.find((t) => t.remote_id === c.parent_id) ??
            chTargets.find((t) => t.remote_id === c.comment_id);
          if (!target) continue;
          const rows = [{
            workspace_id: wsOf(target),
            channel_id: target.channel_id,
            provider: 'mastodon',
            post_target_id: target.id,
            comment_id: c.comment_id,
            parent_id: c.parent_id,
            author: c.author,
            author_avatar: c.author_avatar,
            message: c.message,
            like_count: c.like_count,
            created_at: c.created_at ?? new Date().toISOString(),
          }];
          await rest<unknown>('/rest/v1/platform_comments', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(rows),
          });
          scanned += 1;
        }
      } catch (e) {
        warn(`scan_comments skip mastodon channel ${channelId}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // ---- Per-target providers (facebook / threads / instagram / x).
  for (const target of otherTargets) {
    if (!target.channel_id || !wsOf(target)) continue;
    try {
      let entry = cache.get(target.channel_id);
      if (!entry) {
        const rows = await rest<ChannelRowX[]>(
          `/rest/v1/connected_channels?id=eq.${encodeURIComponent(target.channel_id)}` +
            `&select=id,workspace_id,provider,external_id,instance_url,metadata,status,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)&limit=1`,
        );
        const ch = rows?.[0];
        if (!ch) continue;
        entry = { ch, t: tokenRow(ch), token: await tokenOf(ch, tokenRow(ch)) };
        cache.set(target.channel_id, entry);
      }
      if (chProviderDead(entry.ch)) continue;

      const list =
        target.provider === 'facebook'
          ? await fbComments(target.remote_id, entry.token)
          : target.provider === 'threads'
            ? await threadsReplies(target.remote_id, entry.token)
            : target.provider === 'instagram'
              ? await igComments(target.remote_id, entry.token)
              : target.provider === 'x'
                ? await xReplies(target.remote_id, entry.token)
                : [];

      if (!list.length) continue;
            const rows = list.map((c) => ({
        workspace_id: wsOf(target),
        channel_id: target.channel_id,
        provider: target.provider,
        post_target_id: target.id,
        comment_id: c.comment_id,
        parent_id: c.parent_id,
        author: c.author,
        author_avatar: c.author_avatar,
        message: c.message,
        like_count: c.like_count,
        created_at: c.created_at ?? new Date().toISOString(),
      }));
      await rest<unknown>('/rest/v1/platform_comments', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      scanned += list.length;
      // Bell notifications ride the DB trigger on platform_comments INSERT:
      // merge-duplicates means only genuinely NEW comments fire it, so no
      // worker-side seen-set is needed for the notify path.
    } catch (e) {
      // One dead channel must not sink the sweep.
      warn(`scan_comments skip ${target.provider}/${target.remote_id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  info(`scan_comments: scanned ${scanned} comments across ${(targets ?? []).length} targets`);
}

/** Channels in expired/revoked state are skipped without a fetch. */
function chProviderDead(ch: ChannelRowX): boolean {
  return ch.status !== 'connected';
}
