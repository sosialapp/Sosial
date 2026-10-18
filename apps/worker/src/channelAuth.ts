/**
 * Channel-auth vocabulary shared by the refresh job and the publish path.
 *
 * A channel that can't authenticate has exactly one useful thing to tell the
 * user: reconnect it. The technical reason — provider error text, or the
 * worker missing its OAuth client keys — is operator information and goes to
 * the worker log, never into connected_channels.last_error, the bell, or a
 * failed-post notification.
 */
import { warn } from './logger';

const PROVIDER_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  gmb: 'Google Business Profile',
  tiktok: 'TikTok',
  x: 'X',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  mastodon: 'Mastodon',
  telegram: 'Telegram',
  discord: 'Discord',
};

/** What the user reads in Connect and in notifications when a channel needs
 *  a fresh token. Never carries env vars, file paths or provider internals. */
export function reconnectMessage(provider: string): string {
  return `Your ${PROVIDER_LABEL[provider] ?? provider} connection expired. Reconnect it to keep publishing.`;
}

/** Operator-only detail -> worker log; the thrown error stays user-safe. */
export function missingClientKeys(provider: string, detail: string): Error {
  warn(`${provider}: ${detail}`);
  return new Error(reconnectMessage(provider));
}
