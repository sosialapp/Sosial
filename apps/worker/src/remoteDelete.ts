/**
 * Remote post deletion — "delete in Sosial really deletes on the network".
 *
 * Supported: facebook, instagram, threads, x, youtube, bluesky, mastodon.
 * TikTok has no delete API (docs: content is removable only in-app), so the
 * target is marked skipped with that reason. Telegram/Discord/WordPress/
 * Dev.to/Hashnode/Ghost/VK/LinkedIn/Pinterest/GMB: no stored remote id or
 * no delete endpoint parity yet — skipped with a clear reason, never silent.
 *
 * Job kind 'delete_post_target': { post_target_id }
 * The dispatcher resolves the target's channel + remote_id + access token,
 * calls the platform, and marks the target 'skipped' (remote_deleted) so the
 * row delete that follows never re-publishes or half-orphans.
 */
import { rest, readSecret } from './db';
import type { Job } from './db';
import { tokenRow, type ChannelRow, type TokenRow } from './avatars';
import { warn, info, debug } from './logger';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';
const IG_GRAPH = 'https://graph.facebook.com/v21.0';
const THREADS_API = 'https://graph.threads.net/v1.0';
const X_API = 'https://api.x.com/2';
const YT_API = 'https://www.googleapis.com/youtube/v3';

interface DeletePayload {
  post_target_id: string;
}

async function channelById(channelId: string): Promise<{ c: ChannelRow; t: TokenRow } | null> {
  const rows = await rest<ChannelRow[]>(
    `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
      `&select=id,workspace_id,provider,external_id,instance_url,metadata,status,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)` +
      `&limit=1`,
  );
  const c = rows?.[0];
  if (!c) return null;
  return { c, t: tokenRow(c) };
}

async function tokenOf(ch: { c: ChannelRow; t: TokenRow }): Promise<string> {
  if (!ch.t.access_token_secret_id) throw new Error('token missing, reconnect the channel.');
  const v = await readSecret(ch.t.access_token_secret_id);
  if (!v) throw new Error('token unavailable, reconnect the channel.');
  return v;
}

function graphErr(j: any): string {
  const m = j?.error?.message ?? j?.error_description ?? j?.error ?? j?.message;
  return typeof m === 'string' && m ? m : 'platform refused the delete';
}

/** IG posts are children of the FB Page graph: same DELETE endpoint. */
async function delFacebook(remoteId: string, token: string): Promise<void> {
  const r = await fetch(`${FB_GRAPH}/${encodeURIComponent(remoteId)}`, {
    method: 'DELETE',
    body: new URLSearchParams({ access_token: token }),
  });
  const j: any = await r.json().catch(() => ({}));
  // Already gone counts as success (idempotent retry).
  if (!r.ok && !/does not exist|has been deleted|already deleted/i.test(String(graphErr(j)))) {
    throw new Error(`Facebook refused the delete: ${graphErr(j)}`);
  }
}

async function delThreads(remoteId: string, token: string): Promise<void> {
  const r = await fetch(`${THREADS_API}/${encodeURIComponent(remoteId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const j: any = await r.json().catch(() => ({}));
    throw new Error(`Threads refused the delete: ${graphErr(j)}`);
  }
}

async function delX(remoteId: string, token: string): Promise<void> {
  const r = await fetch(`${X_API}/tweets/${encodeURIComponent(remoteId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  // 404 = already deleted, treat as success.
  if (!r.ok && r.status !== 404) {
    throw new Error(`X refused the delete: ${graphErr(j)}`);
  }
}

async function delYouTube(remoteId: string, token: string): Promise<void> {
  const r = await fetch(`${YT_API}/videos?id=${encodeURIComponent(remoteId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok && r.status !== 404) {
    const t = await r.text().catch(() => '');
    throw new Error(`YouTube refused the delete (${r.status}): ${t.slice(0, 140)}`);
  }
}

/** Bluesky: DELETE app.bsky.feed.post with the repo/commit pattern. */
async function delBluesky(did: string, rkey: string, accessJwt: string, pds: string): Promise<void> {
  const r = await fetch(`${pds}/xrpc/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', rkey }),
  });
  if (!r.ok) {
    const j: any = await r.json().catch(() => ({}));
    if (r.status !== 404) throw new Error(`Bluesky refused the delete: ${graphErr(j)}`);
  }
}

/** Mastodon: DELETE /api/v1/statuses/:id (author-only). */
async function delMastodon(instance: string, remoteId: string, token: string): Promise<void> {
  const r = await fetch(`https://${instance}/api/v1/statuses/${encodeURIComponent(remoteId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok && r.status !== 404) {
    const j: any = await r.json().catch(() => ({}));
    throw new Error(`Mastodon refused the delete: ${graphErr(j)}`);
  }
}

/** Bluesky rkey = last URI segment (at://did/app.bsky.feed.post/RKEY). */
function blueskyRkey(uri: string): string {
  return uri.split('/').pop() ?? '';
}

export async function handleDeletePostTarget(job: Job): Promise<void> {
  const postTargetId = String((job.payload ?? {}).post_target_id ?? '');
  if (!postTargetId) throw new Error(`job ${job.id}: missing post_target_id`);
  debug(`delete_post_target ${postTargetId} (job ${job.id})`);

  const rows = await rest<any[]>(
    `/rest/v1/post_targets?id=eq.${encodeURIComponent(postTargetId)}` +
      `&select=id,provider,remote_id,remote_url,channel_id,status&limit=1`,
  );
  const target = rows?.[0];
  if (!target) {
    debug(`target ${postTargetId} gone, nothing to delete remotely`);
    return;
  }
  // Never sent = nothing exists on the platform.
  if (!target.remote_id) {
    debug(`target ${postTargetId} has no remote_id, skipping remote delete`);
    return;
  }
  const ch = target.channel_id ? await channelById(target.channel_id) : null;
  if (!ch) {
    debug(`channel for target ${postTargetId} gone, cannot delete remotely`);
    return;
  }

  try {
    switch (ch.c.provider) {
      case 'facebook':
      case 'instagram':
        await delFacebook(target.remote_id, await tokenOf(ch));
        break;
      case 'threads':
        await delThreads(target.remote_id, await tokenOf(ch));
        break;
      case 'x':
        await delX(target.remote_id, await tokenOf(ch));
        break;
      case 'youtube':
        await delYouTube(target.remote_id, await tokenOf(ch));
        break;
      case 'mastodon':
        await delMastodon(ch.c.instance_url || String(ch.c.metadata?.instance ?? ''), target.remote_id, await tokenOf(ch));
        break;
      case 'bluesky': {
        const tok = await tokenOf(ch);
        const did = ch.c.external_id;
        const pds = String(ch.c.metadata?.pds ?? 'https://bsky.social');
        await delBluesky(did, blueskyRkey(target.remote_id), tok, pds);
        break;
      }
      case 'tiktok':
        // No public delete API; the in-app delete is the only path.
        info(`tiktok ${target.remote_id}: platform has no delete API, left live`);
        return;
      default:
        info(`${ch.c.provider} ${target.remote_id}: remote delete not supported yet, left live`);
        return;
    }
    info(`remote post deleted ${ch.c.provider}/${target.remote_id}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warn(`delete_post_target failed: ${msg}`);
    throw new Error(msg);
  }
}
