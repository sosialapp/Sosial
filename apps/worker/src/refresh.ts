/**
 * Proactive channel token refresh (refresh_token jobs).
 *
 * Publishers already refresh lazily at publish time via their ensureToken
 * helpers; this job does the same thing on a schedule so a token never
 * expires between queueing and publishing. It reuses the exact same
 * helpers (same rotation, same expires_at bookkeeping), so lazy and
 * proactive refresh can never disagree.
 *
 * Outcome policy:
 * - fresh token / successful rotation → job succeeds.
 * - auth-dead (revoked/expired refresh, missing secrets) → the channel is
 *   marked 'expired' with last_error so the UI prompts a reconnect, and the
 *   job succeeds (nothing to retry — a retry would fail identically).
 * - anything else (network, provider 5xx, rate limit) → throw, so the job
 *   backs off and retries.
 */
import { rest } from './db';
import { restPatch } from './rest';
import { info, warn } from './logger';
import {
  tokenRow,
  bundleFor,
  type ChannelRow,
} from './avatars';
import { ensureToken as ensureTikTokToken } from './tiktok';
import { ensureToken as ensureXToken } from './x';
import { ensureToken as ensureLinkedInToken } from './linkedin';
import { ensureToken as ensurePinterestToken } from './pinterest';
import { ensureToken as ensureYouTubeToken } from './youtube';
import { ensureSession as ensureBlueskySession } from './bsky';

/** Providers with a worker-side rotation helper. Anything else (Meta
 *  family long-lived tokens, Mastodon non-expiring) refreshes at connect
 *  time or publish time and is skipped here. */
export const REFRESHABLE_PROVIDERS = [
  'tiktok',
  'x',
  'linkedin',
  'pinterest',
  'youtube',
  'bluesky',
] as const;

async function getChannel(channelId: string): Promise<ChannelRow | null> {
  const rows = await rest<ChannelRow[]>(
    `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
      `&select=id,workspace_id,provider,external_id,instance_url,metadata,status,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)` +
      `&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function refreshChannelToken(
  channelId: string,
): Promise<'refreshed' | 'skipped'> {
  const c = await getChannel(channelId);
  if (!c || c.status !== 'connected') return 'skipped';
  if (!(REFRESHABLE_PROVIDERS as readonly string[]).includes(c.provider)) return 'skipped';

  const t = tokenRow(c);
  if (!t.access_token_secret_id && !t.refresh_token_secret_id) {
    await restPatch('connected_channels', c.id, {
      status: 'expired',
      last_error: 'Token secrets missing — reconnect the channel.',
    });
    warn(`refresh ${c.provider}/${c.external_id}: no secrets, marked expired`);
    return 'skipped';
  }

  const b = bundleFor(c, t);
  try {
    switch (c.provider) {
      case 'tiktok':
        await ensureTikTokToken(b);
        break;
      case 'x':
        await ensureXToken(b);
        break;
      case 'linkedin':
        await ensureLinkedInToken(b);
        break;
      case 'pinterest':
        await ensurePinterestToken(b);
        break;
      case 'youtube':
        await ensureYouTubeToken(b);
        break;
      case 'bluesky':
        await ensureBlueskySession(b);
        break;
      default:
        return 'skipped';
    }
    // Touch the channel so "last checked" is visible; the helpers already
    // persisted any rotated secrets + expires_at.
    await restPatch('connected_channels', c.id, { updated_at: new Date().toISOString() });
    info(`refresh ${c.provider}/${c.external_id}: ok`);
    return 'refreshed';
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? 'refresh failed');
    if (/expir|revok|reconnect|invalid_grant|invalid_token|__EXPIRED__|unauthorized/i.test(msg)) {
      await restPatch('connected_channels', c.id, {
        status: 'expired',
        last_error: msg.slice(0, 300),
      });
      warn(`refresh ${c.provider}/${c.external_id}: auth-dead, marked expired (${msg.slice(0, 120)})`);
      return 'skipped';
    }
    throw e;
  }
}
