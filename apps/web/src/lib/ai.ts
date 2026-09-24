import type { SupabaseClient } from '@supabase/supabase-js';

/** Caption limits for channels that aren't chain-capable (joined text). */
export const TEXT_CAPS: Record<string, number> = {
  facebook: 63206,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 800,
};

/** Native reply-chain caps (strictest wins across picked chain channels). */
export const THREAD_CAPS: Record<string, number> = {
  x: 280,
  bluesky: 300,
  mastodon: 500,
  threads: 500,
};

export const CAPTION_MAX = 2200;

export const SOCIAL_PLATFORMS: { id: string; label: string }[] = [
  { id: 'any', label: 'All channels' },
  { id: 'x', label: 'X' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'threads', label: 'Threads' },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'pinterest', label: 'Pinterest' },
];

export const THREAD_PLATFORM_IDS = ['x', 'threads', 'mastodon', 'bluesky'];

/** Below this a thread part reads as filler on X — mirrors the mobile rule. */
export const THREAD_POST_MIN = 230;

export function capFor(platform: string, thread = false): number {
  if (platform === 'any') return thread ? THREAD_CAPS.x : CAPTION_MAX;
  if (thread) return THREAD_CAPS[platform] ?? TEXT_CAPS[platform] ?? 280;
  return TEXT_CAPS[platform] ?? THREAD_CAPS[platform] ?? CAPTION_MAX;
}

export function platformLabel(id: string): string {
  return SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

export interface AiVariant {
  platform: string;
  posts: string[];
  hashtags: string[];
}

export type RewriteOp = 'shorter' | 'punchier' | 'natural' | 'context' | 'tone' | 'style';

export interface AiGenerateArgs {
  topic: string;
  /** Destination ids ('any' = general feed) — the model adapts wording per channel. */
  platforms: string[];
  /** true = connected thread chain. */
  thread: boolean;
  /** Target number of thread posts. */
  parts: number;
  tone: string;
  /** Language id ('auto' mirrors the idea). Optional, edge fn defaults to auto. */
  language?: string;
  /** Style id ('auto' lets the model choose). Optional. */
  style?: string;
  /** Extra direction for the writer. Optional. */
  instructions?: string;
  /** 'auto' | 'on' | 'off'. Optional. */
  emoji?: string;
  /** Soft closing CTA. Defaults true. */
  cta?: boolean;
  /** Return hashtags. Defaults false. */
  hashtags?: boolean;
}

/** Call the generate-captions edge function (auth attachs the user JWT). */
export async function generateSocial(
  sb: SupabaseClient,
  args: AiGenerateArgs,
): Promise<AiVariant[]> {
  const { data, error } = await sb.functions.invoke('generate-captions', { body: args });
  if (error) throw new Error(error.message);
  const payload = data as { variants?: AiVariant[]; error?: string } | null;
  const variants = payload?.variants;
  if (!variants?.length) {
    throw new Error(payload?.error ?? 'The AI returned nothing. Try again.');
  }
  return variants;
}

/** Rewrite an existing set of posts in place (targeted transform). Facts must survive. */
export async function rewritePosts(
  sb: SupabaseClient,
  args: { posts: string[]; platform: string; thread: boolean; language?: string; op: RewriteOp },
): Promise<string[]> {
  const { data, error } = await sb.functions.invoke('generate-captions', { body: args });
  if (error) throw new Error(error.message);
  const payload = data as { posts?: string[]; error?: string } | null;
  if (!payload?.posts?.length) {
    throw new Error(payload?.error ?? 'The rewrite came back empty — kept your original.');
  }
  return payload.posts;
}

/** Append hashtags to a caption the way the composer expects. */
export function withHashtags(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((h) => `#${h}`).join(' ');
  if (!tags) return caption;
  return caption ? `${caption}\n\n${tags}` : tags;
}
