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

interface TargetRow {
  id: string;
  post_id: string;
  remote_id: string;
  channel_id: string | null;
  provider: string;
  workspace_id: string;
  post_created_by: string | null;
}

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

async function threadsReplies(remoteId: string, token: string): Promise<RawComment[]> {
  // Threads reads replies of a published thread post.
  const r = await fetch(
    `${THREADS_API}/${encodeURIComponent(remoteId)}/replies?fields=id,text,username,timestamp,like_count,has_replies&limit=25`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `threads replies ${r.status}`);
  const data = Array.isArray(j?.data) ? j.data : [];
  return data
    .filter((c: any) => c?.id && typeof c.text === 'string')
    .map((c: any) => ({
      comment_id: String(c.id),
      parent_id: null,
      author: c?.username ? `@${c.username}` : 'Threads user',
      author_avatar: null,
      message: String(c.text),
      like_count: typeof c.like_count === 'number' ? c.like_count : null,
      created_at: typeof c.timestamp === 'string' ? c.timestamp : null,
    }));
}

export async function handleScanComments(_job: Job): Promise<void> {
  // Recent sent targets on comment-capable providers, newest first, cap 100
  // per sweep: enough coverage, bounded work.
  const targets = await rest<TargetRow[]>(
    `/rest/v1/post_targets?status=eq.sent&provider=in.(facebook,threads,instagram)` +
      `&remote_id=neq.&select=id,post_id,remote_id,channel_id,provider,workspace_id,posts(created_by)` +
      `&order=updated_at.desc&limit=100`,
  ).catch(() => [] as TargetRow[]);
  debug(`scan_comments: ${targets?.length ?? 0} candidate targets`);

  const cache = new Map<string, { ch: ChannelRowX; t: TokenRow; token: string }>();
  let scanned = 0;

  for (const target of targets ?? []) {
    if (!target.channel_id || !target.workspace_id) continue;
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
              : [];

      if (!list.length) continue;
            const rows = list.map((c) => ({
        workspace_id: target.workspace_id,
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
