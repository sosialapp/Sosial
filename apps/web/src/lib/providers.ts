import type { ProviderKey, PostStatus, TargetStatus } from './types';

/** Provider chrome — mirrors the mobile app's SOCIAL_META so both surfaces read the same. */
export const PROVIDER_META: Record<ProviderKey, { label: string; color: string; glyph: string }> = {
  instagram: { label: 'Instagram', color: '#E1306C', glyph: 'IG' },
  tiktok: { label: 'TikTok', color: '#111111', glyph: 'TT' },
  x: { label: 'X', color: '#000000', glyph: 'X' },
  facebook: { label: 'Facebook', color: '#1877F2', glyph: 'f' },
  youtube: { label: 'YouTube', color: '#FF0000', glyph: 'YT' },
  threads: { label: 'Threads', color: '#000000', glyph: 'TH' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', glyph: 'in' },
  bluesky: { label: 'Bluesky', color: '#0285FF', glyph: 'BS' },
  mastodon: { label: 'Mastodon', color: '#6364FF', glyph: 'M' },
  pinterest: { label: 'Pinterest', color: '#E60023', glyph: 'P' },
};

export function providerMeta(p: string): { label: string; color: string; glyph: string } {
  return PROVIDER_META[p as ProviderKey] ?? { label: p, color: '#78716C', glyph: p.slice(0, 2).toUpperCase() };
}

export const POST_STATUS_META: Record<PostStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-surface text-soft' },
  approval: { label: 'Needs approval', className: 'bg-accent-soft text-accent-ink' },
  queued: { label: 'Queued', className: 'bg-accent-soft text-accent-ink' },
  publishing: { label: 'Publishing', className: 'bg-accent-soft text-accent-ink' },
  sent: { label: 'Sent', className: 'bg-[#EDF3EC] text-[#346538]' },
  partial: { label: 'Partially sent', className: 'bg-accent-soft text-accent-ink' },
  failed: { label: 'Failed', className: 'bg-[#FDEBEC] text-[#9F2F2D]' },
};

export const TARGET_STATUS_META: Record<TargetStatus, { label: string; className: string }> = {
  pending: { label: 'Draft', className: 'bg-surface text-soft' },
  needs_approval: { label: 'Approval', className: 'bg-accent-soft text-accent-ink' },
  queued: { label: 'Queued', className: 'bg-accent-soft text-accent-ink' },
  publishing: { label: 'Publishing', className: 'bg-accent-soft text-accent-ink' },
  sent: { label: 'Sent', className: 'bg-[#EDF3EC] text-[#346538]' },
  failed: { label: 'Failed', className: 'bg-[#FDEBEC] text-[#9F2F2D]' },
  skipped: { label: 'Skipped', className: 'bg-surface text-muted' },
};
