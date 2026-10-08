/**
 * Job dispatch by kind. Handlers are stubs in this scaffold — each one gets
 * its real implementation (ported publisher adapters, refresh logic,
 * analytics snapshots) in the next slice. A stub throws, which routes the
 * job to backoff/dead-letter via complete_job — never a silent success.
 */
import type { Job } from './db';
import {
  getPublishBundle,
  markTargetSent,
  markTargetFailed,
  getInvite,
  resendInviteEmail,
  deferJob,
  channelDailyRemaining,
  channelDailyNextSlot,
} from './db';
import { publishBlueskyTarget, blueskyPostUrl } from './bsky';
import { publishThreadsTarget } from './threads';
import { publishXTarget } from './x';
import { publishYouTubeTarget } from './youtube';
import { publishTikTokTarget } from './tiktok';
import { publishFacebookTarget, publishInstagramTarget } from './meta';
import { publishMastodonTarget } from './mastodon';
import { publishLinkedInTarget } from './linkedin';
import { publishPinterestTarget } from './pinterest';
import { publishTelegramTarget } from './telegram';
import { publishDiscordTarget } from './discord';
import { publishWordPressTarget } from './wordpress';
import { publishDevtoTarget } from './devto';
import { publishHashnodeTarget } from './hashnode';
import { publishGhostTarget } from './ghost';
import { publishVkTarget } from './vk';
import { publishGmbTarget } from './gmb';
import { syncWorkspaceAvatars } from './avatars';
import { refreshChannelToken } from './refresh';
import { sendPushBroadcast } from './push';
import { snapshotChannel } from './stats';
import { info, debug } from './logger';

function notPorted(kind: string): Error {
  return new Error(`job kind '${kind}' not ported yet — see apps/worker/README.md`);
}

async function handlePublishTarget(job: Job): Promise<void> {
  const targetId = String(job.payload?.post_target_id ?? '');
  if (!targetId) throw new Error(`job ${job.id}: missing post_target_id`);
  debug(`publish_target ${targetId} (job ${job.id})`);
  const bundle = await getPublishBundle(targetId);
  if (!bundle) throw new Error(`target ${targetId} not found — nothing to publish`);
  const status = String(bundle?.target?.status ?? '');
  // Terminal states never re-fire: sent = idempotent success (cron only
  // enqueues 'queued', so reaching here sent means a retry after success).
  if (status === 'sent') {
    debug(`target ${targetId} already sent — skipping`);
    return;
  }
  if (status !== 'queued' && status !== 'publishing') {
    throw new Error(`target ${targetId} in status '${status}' — refusing to publish`);
  }
  const provider = String(bundle?.target?.provider ?? '');
  const channelId = String(bundle?.channel?.id ?? '');

  // Gate B — daily anti-abuse guard. The provider caps posts per rolling 24h;
  // if this channel's window is full, park the job (no attempt burned) until
  // the oldest send ages out, so the post is delayed, never lost or throttled.
  if (channelId) {
    const remaining = await channelDailyRemaining(channelId, provider);
    if (remaining <= 0) {
      const nextSlot = await channelDailyNextSlot(channelId);
      const runAt = nextSlot && new Date(nextSlot).getTime() > Date.now()
        ? nextSlot
        : new Date(Date.now() + 60_000).toISOString();
      info(`target ${targetId} deferred — ${provider} daily window full (job ${job.id}, run_at ${runAt})`);
      await deferJob(job.id, runAt);
      return;
    }
  }

  try {
    if (provider === 'bluesky') {
      const uri = await publishBlueskyTarget(bundle);
      const did = String(bundle?.channel?.external_id ?? '');
      await markTargetSent(targetId, uri, blueskyPostUrl(uri, did));
      debug(`target ${targetId} sent → ${uri}`);
      return;
    }
    if (provider === 'threads') {
      const { remoteId, remoteUrl } = await publishThreadsTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'x') {
      const { tweetId, tweetUrl } = await publishXTarget(bundle);
      await markTargetSent(targetId, tweetId, tweetUrl);
      debug(`target ${targetId} sent → ${tweetId}`);
      return;
    }
    if (provider === 'tiktok') {
      const { publishId } = await publishTikTokTarget(bundle);
      await markTargetSent(targetId, publishId, '');
      debug(`target ${targetId} sent → ${publishId}`);
      return;
    }
    if (provider === 'youtube') {
      const { videoId, videoUrl } = await publishYouTubeTarget(bundle);
      await markTargetSent(targetId, videoId, videoUrl);
      debug(`target ${targetId} sent → ${videoId}`);
      return;
    }
    if (provider === 'facebook') {
      const { remoteId, remoteUrl } = await publishFacebookTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'instagram') {
      const { remoteId, remoteUrl } = await publishInstagramTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'mastodon') {
      const { remoteId, remoteUrl } = await publishMastodonTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'linkedin') {
      const { remoteId, remoteUrl } = await publishLinkedInTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'pinterest') {
      const { remoteId, remoteUrl } = await publishPinterestTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'telegram') {
      const { remoteId, remoteUrl } = await publishTelegramTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'discord') {
      const { remoteId, remoteUrl } = await publishDiscordTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'wordpress') {
      const { remoteId, remoteUrl } = await publishWordPressTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'devto') {
      const { remoteId, remoteUrl } = await publishDevtoTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'hashnode') {
      const { remoteId, remoteUrl } = await publishHashnodeTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'ghost') {
      const { remoteId, remoteUrl } = await publishGhostTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'vk') {
      const { remoteId, remoteUrl } = await publishVkTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
      return;
    }
    if (provider === 'gmb') {
      const { remoteId, remoteUrl } = await publishGmbTarget(bundle);
      await markTargetSent(targetId, remoteId, remoteUrl);
      debug(`target ${targetId} sent → ${remoteId}`);
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
  debug(`refresh_token channel ${channelId} (job ${job.id})`);
  const outcome = await refreshChannelToken(channelId);
  debug(`refresh_token channel ${channelId}: ${outcome} (job ${job.id})`);
}

async function handleSnapshotAnalytics(job: Job): Promise<void> {
  const channelId = String(job.payload?.channel_id ?? '');
  if (!channelId) throw new Error(`job ${job.id}: missing channel_id`);
  debug(`snapshot_analytics channel ${channelId} (job ${job.id})`);
  const { updated, failed, skipped } = await snapshotChannel(channelId);
  if (skipped) debug(`snapshot_analytics channel ${channelId}: skipped (${skipped})`);
  else debug(`snapshot_analytics channel ${channelId}: ${updated} updated, ${failed} failed`);
}

async function handleSyncAvatars(job: Job): Promise<void> {
  const workspaceId = job.payload?.workspace_id ? String(job.payload.workspace_id) : undefined;
  debug(`sync_avatars workspace ${workspaceId ?? '(all)'} (job ${job.id})`);
  const { checked, saved, failed } = await syncWorkspaceAvatars(workspaceId);
  debug(`sync_avatars done: ${checked} checked, ${saved} saved, ${failed.length} failed`);
}

async function handleSendPush(job: Job): Promise<void> {
  const title = String(job.payload?.title ?? '').trim();
  const body = String(job.payload?.body ?? '').trim();
  if (!title || !body) throw new Error(`job ${job.id}: send_push needs title + body`);
  debug(`send_push "${title.slice(0, 60)}" (job ${job.id})`);
  await sendPushBroadcast(title, body);
}

async function handleCleanupMedia(job: Job): Promise<void> {
  debug(`cleanup_media (job ${job.id})`);
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
    debug(`invite ${inviteId} gone — nothing to do`);
    return;
  }
  if (inv.accepted_at) {
    debug(`invite ${inviteId} already accepted`);
    return;
  }
  if (Date.now() > new Date(inv.expires_at).getTime()) {
    debug(`invite ${inviteId} expired`);
    return;
  }
  try {
    await resendInviteEmail(inv);
  } catch (e) {
    // Already on Sosial: GoTrue will never email an existing user — the
    // invite link goes out through the inviter instead. Complete the job;
    // retrying could never succeed.
    if (/already (been )?registered|already exists/i.test(e instanceof Error ? e.message : String(e))) {
      debug(`invite ${inviteId} already registered — link handoff, no retry`);
      return;
    }
    throw e;
  }
  debug(`invite ${inviteId} resent to ${inv.email}`);
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
