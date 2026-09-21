import type { ProviderKey, PostStatus, TargetStatus } from './types';

export interface ProviderInfo {
  label: string;
  /** Brand colour — matches the mobile app so both surfaces read the same. */
  color: string;
  /** Two-letter fallback mark (used in dense table rows). */
  glyph: string;
  /** Real per-post character limit for the feed caption. */
  limit: number;
  /** What the channel is best at — drives the composer's channel hints. */
  kind: 'social' | 'video' | 'professional' | 'visual';
}

export const PROVIDER_META: Record<ProviderKey, ProviderInfo> = {
  instagram: { label: 'Instagram', color: '#E1306C', glyph: 'IG', limit: 2200, kind: 'visual' },
  tiktok: { label: 'TikTok', color: '#111111', glyph: 'TT', limit: 2200, kind: 'video' },
  x: { label: 'X', color: '#000000', glyph: 'X', limit: 280, kind: 'social' },
  facebook: { label: 'Facebook', color: '#1877F2', glyph: 'f', limit: 63206, kind: 'social' },
  youtube: { label: 'YouTube', color: '#FF0000', glyph: 'YT', limit: 5000, kind: 'video' },
  threads: { label: 'Threads', color: '#000000', glyph: 'TH', limit: 500, kind: 'social' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', glyph: 'in', limit: 3000, kind: 'professional' },
  bluesky: { label: 'Bluesky', color: '#0285FF', glyph: 'BS', limit: 300, kind: 'social' },
  mastodon: { label: 'Mastodon', color: '#6364FF', glyph: 'M', limit: 500, kind: 'social' },
  pinterest: { label: 'Pinterest', color: '#E60023', glyph: 'P', limit: 500, kind: 'visual' },
};

export function providerMeta(p: string): ProviderInfo {
  return (
    PROVIDER_META[p as ProviderKey] ?? {
      label: p,
      color: '#78716C',
      glyph: p.slice(0, 2).toUpperCase(),
      limit: 2200,
      kind: 'social',
    }
  );
}

/** Every channel Sosial publishes to, in marketing order. */
export const ALL_PROVIDERS = Object.keys(PROVIDER_META) as ProviderKey[];

export const POST_STATUS_META: Record<PostStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-surface text-soft' },
  approval: { label: 'Needs approval', className: 'bg-accent-soft text-accent-ink' },
  queued: { label: 'Queued', className: 'bg-accent-soft text-accent-ink' },
  publishing: { label: 'Publishing', className: 'bg-accent-soft text-accent-ink' },
  sent: { label: 'Sent', className: 'bg-[#EDF3EC] text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]' },
  partial: { label: 'Partially sent', className: 'bg-accent-soft text-accent-ink' },
  failed: { label: 'Failed', className: 'bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]' },
};

export const TARGET_STATUS_META: Record<TargetStatus, { label: string; className: string }> = {
  pending: { label: 'Draft', className: 'bg-surface text-soft' },
  needs_approval: { label: 'Approval', className: 'bg-accent-soft text-accent-ink' },
  queued: { label: 'Queued', className: 'bg-accent-soft text-accent-ink' },
  publishing: { label: 'Publishing', className: 'bg-accent-soft text-accent-ink' },
  sent: { label: 'Sent', className: 'bg-[#EDF3EC] text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]' },
  failed: { label: 'Failed', className: 'bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]' },
  skipped: { label: 'Skipped', className: 'bg-surface text-muted' },
};
