/**
 * Channel capability profiles + the shared compatibility engine (Phase 0).
 *
 * Pure module — zero imports — so the worker can adopt the same file
 * verbatim later. Limits mirror PROVIDER_META (lib/providers.ts); the chain
 * set mirrors CHAIN_PROVIDERS (lib/posts.ts). If a platform changes its
 * API, update the profile here, not the composer.
 */

export interface CapabilityProfile {
  label: string;
  supports: {
    text: boolean;
    image: boolean;
    video: boolean;
    carousel: boolean;
    document: boolean;
    poll: boolean;
    link: boolean;
  };
  /** Multi-post composer (X/Threads-style threads, reply chains). */
  thread: boolean;
  replyChain: boolean;
  /** Long-form article channel (Phase 1+: wordpress/devto/hashnode/ghost). */
  article: boolean;
  /** Head part must carry at least one photo or video. */
  requiresMedia: boolean;
  /** Head part must carry a video. */
  requiresVideo: boolean;
  /** A destination must be chosen (boards today, communities later). */
  boardRequired: boolean;
  /** An article title must be present (article channels). */
  titleRequired: boolean;
  /** Declared options (mastodon visibility); composer UI lands per-channel. */
  visibility?: string[];
  contentWarning?: boolean;
  limits: { text: number; title?: number; media?: number };
}

export const CAPABILITIES: Record<string, CapabilityProfile> = {
  instagram: {
    label: 'Instagram',
    supports: { text: true, image: true, video: true, carousel: true, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: true, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 2200, media: 10 },
  },
  facebook: {
    label: 'Facebook',
    supports: { text: true, image: true, video: true, carousel: true, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 63206 },
  },
  tiktok: {
    label: 'TikTok',
    supports: { text: true, image: true, video: true, carousel: false, document: false, poll: false, link: false },
    thread: false, replyChain: false, article: false,
    requiresMedia: true, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 2200 },
  },
  youtube: {
    label: 'YouTube',
    supports: { text: true, image: false, video: true, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: true, requiresVideo: true,
    boardRequired: false, titleRequired: false,
    limits: { text: 5000, title: 100 },
  },
  x: {
    label: 'X',
    supports: { text: true, image: true, video: true, carousel: false, document: false, poll: true, link: true },
    thread: true, replyChain: true, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 280, media: 4 },
  },
  linkedin: {
    label: 'LinkedIn',
    supports: { text: true, image: true, video: true, carousel: false, document: true, poll: true, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 3000 },
  },
  threads: {
    label: 'Threads',
    supports: { text: true, image: true, video: true, carousel: true, document: false, poll: false, link: true },
    thread: true, replyChain: true, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 500, media: 10 },
  },
  pinterest: {
    label: 'Pinterest',
    supports: { text: true, image: true, video: true, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: true, requiresVideo: false,
    boardRequired: true, titleRequired: false,
    limits: { text: 800 },
  },
  bluesky: {
    label: 'Bluesky',
    supports: { text: true, image: true, video: true, carousel: false, document: false, poll: false, link: true },
    thread: true, replyChain: true, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 300, media: 4 },
  },
  mastodon: {
    label: 'Mastodon',
    // Note: text limit varies by server (500 default); per-server config is
    // a follow-up — the profile carries the default.
    supports: { text: true, image: true, video: true, carousel: false, document: false, poll: true, link: true },
    thread: true, replyChain: true, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    visibility: ['public', 'unlisted', 'private', 'direct'],
    contentWarning: true,
    limits: { text: 500, media: 4 },
  },
  telegram: {
    label: 'Telegram',
    // Bot API: text, photo, video, albums (sendMediaGroup). No polls on our
    // publish path and no native scheduling — Sosial's worker owns the clock.
    supports: { text: true, image: true, video: true, carousel: true, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    // Captions cap at 1024; the adapter truncates longer body text.
    limits: { text: 1024, media: 10 },
  },
  discord: {
    label: 'Discord',
    // Bot posts to a channel: text, images, videos/files as attachments,
    // links auto-embed. Content caps at 2000 (backend rejects, never truncates).
    supports: { text: true, image: true, video: true, carousel: false, document: true, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 2000, media: 10 },
  },
  wordpress: {
    label: 'WordPress',
    // Article channel: title + body publish as a post. No media/thread
    // requirements; long-form has no practical cap at this layer.
    supports: { text: true, image: true, video: true, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: true,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 100000, media: 1 },
  },
  devto: {
    label: 'Dev.to',
    // Forem article: title + markdown body. Tags cap at 4 (backend trims);
    // the first attached image ships as the cover (main_image) via a
    // publish-time signed URL the worker mints. Videos stay unsupported.
    supports: { text: true, image: true, video: false, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: true,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 100000 },
  },
  hashnode: {
    label: 'Hashnode',
    // Publication article: title + markdown body via publishPost. Same v1
    // shape as Dev.to (no tags/covers without composer fields for them).
    supports: { text: true, image: false, video: false, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: true,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 100000 },
  },
  ghost: {
    label: 'Ghost',
    // Site article: title + body as paragraph blocks, published. Same v1
    // shape (no tags/covers/newsletters without composer fields for them).
    supports: { text: true, image: true, video: false, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: true,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 100000, media: 1 },
  },
  vk: {
    label: 'VK',
    // Community wall post as the community: message + up to 10 uploaded
    // photos. Videos need the video.save dance + processing poll — v1 sends
    // none. Personal-profile posting is VK-gated, so communities only.
    supports: { text: true, image: true, video: false, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 16384, media: 10 },
  },
  gmb: {
    label: 'Google Business',
    // Local post (STANDARD topic): 1500-char summary. Offers/events need
    // structured payloads, CTAs need composer fields, media needs the
    // media.startUpload dance — v1 sends text only.
    supports: { text: true, image: false, video: false, carousel: false, document: false, poll: false, link: true },
    thread: false, replyChain: false, article: false,
    requiresMedia: false, requiresVideo: false,
    boardRequired: false, titleRequired: false,
    limits: { text: 1500 },
  },
};

export type CompatLevel = 'error' | 'warn';

export interface CompatIssue {
  provider: string;
  level: CompatLevel;
  message: string;
}

export interface CompatChannel {
  provider: string;
  metadata?: Record<string, unknown> | null;
}

export interface CompatPart {
  body: string;
  /** Media kinds riding on this part ('image' | 'video'). */
  kinds: string[];
}

function boardOf(metadata?: Record<string, unknown> | null): string {
  const v = metadata?.pinBoardId;
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Per-channel verdicts for a draft. Media is read from the head part only
 * (both composers attach uploads to part 1). Unknown providers are skipped
 * — the engine never blocks what it cannot judge.
 */
export function checkCompatibility(
  channels: CompatChannel[],
  opts: { thread: boolean; parts: CompatPart[]; title?: string },
): CompatIssue[] {
  const issues: CompatIssue[] = [];
  const parts = opts.parts.length ? opts.parts : [{ body: '', kinds: [] as string[] }];
  const headKinds = parts[0].kinds;
  const hasVideo = headKinds.includes('video');

  for (const ch of channels) {
    const cap = CAPABILITIES[ch.provider];
    if (!cap) continue;

    if (opts.thread && !cap.thread) {
      issues.push({
        provider: ch.provider,
        level: 'error',
        message: `${cap.label} doesn't do threads — switch the thread off or drop the channel.`,
      });
      continue;
    }

    if (cap.requiresVideo && !hasVideo) {
      issues.push({
        provider: ch.provider,
        level: 'error',
        message: `${cap.label} needs a video.`,
      });
    } else if (cap.requiresMedia && headKinds.length === 0) {
      issues.push({
        provider: ch.provider,
        level: 'error',
        message: `${cap.label} needs a photo or video.`,
      });
    }

    if (cap.boardRequired && !boardOf(ch.metadata)) {
      issues.push({
        provider: ch.provider,
        level: 'error',
        message: `${cap.label} needs a board — pick one in Connect before scheduling.`,
      });
    }

    if (cap.titleRequired && !(opts.title ?? '').trim()) {
      issues.push({
        provider: ch.provider,
        level: 'error',
        message: `${cap.label} needs an article title.`,
      });
    }

    parts.forEach((part, i) => {
      const over = part.body.length - cap.limits.text;
      if (over > 0) {
        const where = parts.length > 1 ? ` part ${i + 1}` : '';
        issues.push({
          provider: ch.provider,
          level: 'error',
          message: `${cap.label}${where} is ${over} characters over the limit.`,
        });
      }
    });
  }

  return issues;
}

/** Worst level across a provider's issues for panel display. */
export function providerStatus(
  provider: string,
  issues: CompatIssue[],
): 'ok' | 'warn' | 'error' {
  let status: 'ok' | 'warn' | 'error' = 'ok';
  for (const i of issues) {
    if (i.provider !== provider) continue;
    if (i.level === 'error') return 'error';
    status = 'warn';
  }
  return status;
}
