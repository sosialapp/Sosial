/**
 * Job dispatch by kind. Handlers are stubs in this scaffold — each one gets
 * its real implementation (ported publisher adapters, refresh logic,
 * analytics snapshots) in the next slice. A stub throws, which routes the
 * job to backoff/dead-letter via complete_job — never a silent success.
 */
import type { Job } from './db';
import { getPublishBundle, markTargetSent, markTargetFailed, getInvite, resendInviteEmail } from './db';
import { publishBlueskyTarget, blueskyPostUrl } from './bsky';
import { publishThreadsTarget } from './threads';
import { publishXTarget } from './x';
import { publishYouTubeTarget } from './youtube';
import { publishTikTokTarget } from './tiktok';
import { publishFacebookTarget, publishInstagramTarget } from './meta';
import { publishMastodonTarget } from './mastodon';
import { publishLinkedInTarget } from './linkedin';
import { publishPinterestTarget } from './pinterest';
import { syncWorkspaceAvatars } from './avatars';
import { refreshChannelToken } from './refresh';
import { sendPushBroadcast } from './push';
import { snapshotChannel } from './stats';
import { info } from './logger';

function notPorted(kind: string): Error {
  return new Error(`job kind '${kind}' not ported yet — see apps/worker/README.md`);
}

async function handlePublishTarget(job: Job): Promise<void> {
  const targetId = String(job.payload?.post_target_id ?? '');
  if (!targetId) throw new Error(`job ${job.id}: missing post_target_id`);
  info(`publish_target ${targetId} (job ${job.id})`);
  const bundle = await getPublishBundle(targetId);
  if (!bundle) throw new Error(`target ${targetId} not found — nothing to publish`);
  const status = String(bundle?.target?.status ?? '');
  // Terminal states never re-fire: sent = idempotent success (cron only
  // enqueues 'queued', so reaching here sent means a retry after success).
  if (status === 'sent') {
    info(`target ${targetId} already sent — skipping`);
    return;
  }
  if (status !== 'queued' && status !== 'publishing') {
    throw new Error(`target ${targetId} in status '${status}' — refusing to publish`);
  }
  const provider = String(bundle?.target?.provider ?? '');
  try {
    if (provider === 'bluesky') {
      const uri = await publishBlueskyTarget(bundle);
      const did = String(bundle?.channel?.external_id ?? '');
      await markTargetSent(targetId, uri, blueskyPostUrl(uri, did));
      info(`target ${targetId} sent → ${uri}`);
      return;
    }
    if (provider === 'threads') {
      const { remoteId, remoteUrl } = await publishThreadsTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      info(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'x') {
      const { tweetId, tweetUrl } = await publishXTarget(bundle);
      await markTargetSent(targetId, tweetId, tweetUrl);
      info(`target ${targetId} sent → ${tweetId}`);
      return;
    }
    if (provider === 'tiktok') {
      const { publishId } = await publishTikTokTarget(bundle);
      await markTargetSent(targetId, publishId, '');
      info(`target ${targetId} sent → ${publishId}`);
      return;
    }
    if (provider === 'youtube') {
      const { videoId, videoUrl } = await publishYouTubeTarget(bundle);
      await markTargetSent(targetId, videoId, videoUrl);
      info(`target ${targetId} sent → ${videoId}`);
      return;
    }
    if (provider === 'facebook') {
      const { remoteId, remoteUrl } = await publishFacebookTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      info(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'instagram') {
      const { remoteId, remoteUrl } = await publishInstagramTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      info(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'mastodon') {
      const { remoteId, remoteUrl } = await publishMastodonTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      info(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'linkedin') {
      const { remoteId, remoteUrl } = await publishLinkedInTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      info(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'pinterest') {
      const { remoteId, remoteUrl } = await publishPinterestTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      info(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    throw notPorted(`publish_target:${provider}`);
  } catch (e: any) {
    // Record terminal publish state (best-effort) before the job backoff.
    try {
      await markTargetFailed(targetId, String(e?.message ?? e ?? 'publish failed').slice(0, 500));
    } catch {}
    throw e;
  }
}

async function handleRefreshToken(job: Job): Promise<void> {
  const channelId = String(job.payload?.channel_id ?? '');
  if (!channelId) throw new Error(`job ${job.id}: missing channel_id`);
  info(`refresh_token channel ${channelId} (job ${job.id})`);
  const outcome = await refreshChannelToken(channelId);
  info(`refresh_token channel ${channelId}: ${outcome} (job ${job.id})`);
}

async function handleSnapshotAnalytics(job: Job): Promise<void> {
  const channelId = String(job.payload?.channel_id ?? '');
  if (!channelId) throw new Error(`job ${job.id}: missing channel_id`);
  info(`snapshot_analytics channel ${channelId} (job ${job.id})`);
  const { updated, failed, skipped } = await snapshotChannel(channelId);
  if (skipped) info(`snapshot_analytics channel ${channelId}: skipped (${skipped})`);
  else info(`snapshot_analytics channel ${channelId}: ${updated} updated, ${failed} failed`);
}

async function handleSyncAvatars(job: Job): Promise<void> {
  const workspaceId = job.payload?.workspace_id ? String(job.payload.workspace_id) : undefined;
  info(`sync_avatars workspace ${workspaceId ?? '(all)'} (job ${job.id})`);
  const { checked, saved, failed } = await syncWorkspaceAvatars(workspaceId);
  info(`sync_avatars done: ${checked} checked, ${saved} saved, ${failed.length} failed`);
}

async function handleSendPush(job: Job): Promise<void> {
  const title = String(job.payload?.title ?? '').trim();
  const body = String(job.payload?.body ?? '').trim();
  if (!title || !body) throw new Error(`job ${job.id}: send_push needs title + body`);
  info(`send_push "${title.slice(0, 60)}" (job ${job.id})`);
  await sendPushBroadcast(title, body);
}

async function handleCleanupMedia(job: Job): Promise<void> {
  info(`cleanup_media (job ${job.id})`);
  throw notPorted('cleanup_media');
}

async function handleSendInvite(job: Job): Promise<void> {
  const inviteId = String(job.payload?.invite_id ?? '');
  if (!inviteId) throw new Error(`job ${job.id}: missing invite_id`);
  const inv = await getInvite(inviteId);
  // Terminal states complete the job: deleted, accepted, or expired invites
  // need no email. Anything live gets a real re-send (GoTrue invite is
  // idempotent per email), so Edge-side mail failures heal here.
  if (!inv) {
    info(`invite ${inviteId} gone — nothing to do`);
    return;
  }
  if (inv.accepted_at) {
    info(`invite ${inviteId} already accepted`);
    return;
  }
  if (Date.now() > new Date(inv.expires_at).getTime()) {
    info(`invite ${inviteId} expired`);
    return;
  }
  await resendInviteEmail(inv);
  info(`invite ${inviteId} resent to ${inv.email}`);
}

export async function dispatch(job: Job): Promise<void> {
  switch (job.kind) {
    case 'publish_target': return handlePublishTarget(job);
    case 'refresh_token': return handleRefreshToken(job);
    case 'snapshot_analytics': return handleSnapshotAnalytics(job);
    case 'cleanup_media': return handleCleanupMedia(job);
    case 'send_invite': return handleSendInvite(job);
    case 'sync_avatars': return handleSyncAvatars(job);
    case 'send_push': return handleSendPush(job);
    default: throw new Error(`unknown job kind '${String((job as any)?.kind)}' (job ${job.id})`);
  }
}
