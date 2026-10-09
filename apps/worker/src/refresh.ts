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
import { rest, callRpc } from './db';
import { readSecret } from './db';import { restPatch } from './rest';
import { info, warn } from './logger';
import {
  tokenRow,
  bundleFor,
  type ChannelRow,
  type TokenRow,
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

/** Live ping for providers that never rotate (bot tokens, Mastodon). Throws
 *  auth-flavoured errors so the shared catch below marks the channel expired. */
async function pingChannel(c: ChannelRow, t: TokenRow): Promise<void> {
  const secret = t.access_token_secret_id ? await readSecret(t.access_token_secret_id) : null;
  if (!secret) throw new Error('Token secrets missing — reconnect the channel.');
  if (c.provider === 'telegram') {
    const r = await fetch(`https://api.telegram.org/bot${secret}/getMe`);
    const j = (await r.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!r.ok || !j?.ok) {
      throw new Error(`Telegram rejected the bot token (unauthorized): ${j?.description ?? r.status}. Reconnect the channel.`);
    }
    return;
  }
  if (c.provider === 'discord') {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${secret}` },
    });
    if (r.status === 401 || r.status === 403) {
      throw new Error('Discord rejected the bot token (unauthorized) — reconnect the channel.');
    }
    if (!r.ok) throw new Error(`Discord ping failed (${r.status})`);
    return;
  }
  // Mastodon: same base normalization as the publisher.
  const host = String(c.instance_url ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .split('/')[0]
    .split('?')[0];
  if (!host || /\s/.test(host)) throw new Error('Mastodon channel missing its instance — reconnect the channel.');
  const r = await fetch(`https://${host}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (r.status === 401 || r.status === 403) {
    throw new Error('Mastodon rejected the token (unauthorized) — reconnect the channel.');
  }
  if (!r.ok) throw new Error(`Mastodon ping failed (${r.status})`);
}

export async function refreshChannelToken(
  channelId: string,
): Promise<'refreshed' | 'skipped'> {
  const c = await getChannel(channelId);
  if (!c || c.status !== 'connected') return 'skipped';
  if (!(REFRESHABLE_PROVIDERS as readonly string[]).includes(c.provider)) return 'skipped';

  /** Bell-notify owner+admins that this channel's auth is dead (p62). The DB
   *  function dedupes per channel/day; failures never break the refresh. */
  const notifyExpired = (reason: string) =>
    callRpc('notify_channel_expired', {
      p_workspace_id: c.workspace_id,
      p_channel_id: c.id,
      p_provider: c.provider,
      p_reason: reason,
    }).catch(() => {});

  const t = tokenRow(c);
  if (!t.access_token_secret_id && !t.refresh_token_secret_id) {
    await restPatch('connected_channels', c.id, {
      status: 'expired',
      last_error: 'Token secrets missing — reconnect the channel.',
    });
    await notifyExpired('Token secrets missing — reconnect the channel.');
    warn(`refresh ${c.provider}/${c.external_id}: no secrets, marked expired`);
    return 'skipped';
  }

  const b = bundleFor(c, t);
  try {
    // Bot-token providers don't rotate — a live ping is the health check.
    // Mastodon tokens don't expire either; verify_credentials proves them.
    if (c.provider === 'telegram' || c.provider === 'discord' || c.provider === 'mastodon') {
      await pingChannel(c, t);
      await restPatch('connected_channels', c.id, {
        status: 'connected',
        last_error: null,
        updated_at: new Date().toISOString(),
      });
      info(`refresh ${c.provider}/${c.external_id}: ping ok`);
      return 'refreshed';
    }
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
      await notifyExpired(msg.slice(0, 300));
      warn(`refresh ${c.provider}/${c.external_id}: auth-dead, marked expired (${msg.slice(0, 120)})`);
      return 'skipped';
    }
    // Refresh can never run without the provider's OAuth client keys on the
    // worker — and lazy refresh at publish time fails identically, so the
    // channel genuinely cannot publish. Mark + notify with an actionable
    // reason; reconnecting heals it until the next expiry.
    if (/needs .+ on the worker/i.test(msg)) {
      const reason = `${msg.slice(0, 200)} Reconnect this account for a fresh token.`;
      await restPatch('connected_channels', c.id, {
        status: 'expired',
        last_error: reason,
      });
      await notifyExpired(reason);
      warn(`refresh ${c.provider}/${c.external_id}: missing client keys, marked expired`);
      return 'skipped';
    }
    throw e;
  }
}
