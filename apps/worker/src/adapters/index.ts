/**
 * Adapter registry. The sync engine asks for an adapter by provider and
 * capabilities; anything not in Phase 1 throws a plain-language error that
 * surfaces verbatim in the product (tooltips on disabled actions).
 */
import type { Account, Capabilities, InboxAdapter } from './types';
import { facebook } from './facebook';
import { instagram } from './instagram';
import { mastodon } from './mastodon';
import { x } from './x';
import { bluesky } from './bluesky';

const registry: Record<string, InboxAdapter> = {
  facebook,
  instagram,
  mastodon,
  x,
  bluesky,
};

/** Providers with chat/comment capability but no unified support yet. */
const notAvailable: Record<string, string> = {
  threads: 'Unified Inbox for Threads is coming in the next release — comments sync still runs per-post.',
  youtube: 'Comments for YouTube are planned; DMs are not offered by the API.',
  linkedin: 'Unified messaging for LinkedIn is planned.',
  tiktok: 'Unified messaging for TikTok is not available — the API only exposes comments.',
  pinterest: 'Messaging and comment management are not exposed by the Pinterest API.',
  wordpress: 'WordPress channels publish only — no comments or messaging.',
};

export function adapterFor(provider: string): InboxAdapter {
  const adapter = registry[provider];
  if (adapter) return adapter;
  const reason = notAvailable[provider];
  throw new Error(
    reason ?? `${provider} does not support the unified inbox yet.`,
  );
}

export function capabilitiesFor(provider: string): Capabilities {
  try {
    return adapterFor(provider).capabilities();
  } catch (err) {
    void err;
    return { inbox: false, comments: false, hideComment: false, deleteComment: false };
  }
}

export function providerSupported(provider: string): boolean {
  return provider in registry;
}
