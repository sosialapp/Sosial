import type { Category, ResourceKind } from '@/content/types';

/**
 * Pastel tints for blog topics and library kinds. Plain data, so the site's
 * Resources pages and the edge-rendered link previews share one palette.
 */

export type Tone = { bg: string; ink: string; sub: string };

/** Blog topic tints, matching the BLOG_TAG_STYLES chips. */
export const TAG_TONES: Record<Category, Tone> = {
  Publishing: { bg: '#FDF3D7', ink: '#5C4300', sub: '#7A5A00' },
  Strategy: { bg: '#E4F2E5', ink: '#1F4423', sub: '#2F5D33' },
  AI: { bg: '#EDE7FB', ink: '#33276B', sub: '#4B3B8F' },
  Teams: { bg: '#E3EDF9', ink: '#1C3A61', sub: '#2B4E7E' },
  Growth: { bg: '#FCE9DC', ink: '#6B3714', sub: '#8A4B22' },
  Product: { bg: '#F9E4EC', ink: '#6B2343', sub: '#8A3358' },
};

/** Library kinds, borrowing the pricing card pastels. */
export const KIND_TONES: Record<ResourceKind, Tone> = {
  Playbook: { bg: '#D6EFE0', ink: '#16452C', sub: '#2F5C42' },
  Glossary: { bg: '#DCE6FF', ink: '#1E2B5C', sub: '#42507E' },
  Guide: { bg: '#E6DEFB', ink: '#3A2A66', sub: '#5A4B86' },
  Template: { bg: '#F9DCEF', ink: '#5E1147', sub: '#7E3B68' },
  'Cheat sheet': { bg: '#FDF3D7', ink: '#5C4300', sub: '#7A5A00' },
};
