import type { ProviderKey } from '@/lib/types';

export type Block =
  | { t: 'p'; c: string }
  | { t: 'h'; c: string }
  | { t: 'ul'; c: string[] }
  | { t: 'quote'; c: string }
  | { t: 'img'; c: string; alt?: string; caption?: string }
  | { t: 'video'; c: string }
  | { t: 'table'; c: string[][]; head?: boolean };

export type Category = 'Publishing' | 'Strategy' | 'AI' | 'Teams' | 'Growth' | 'Product';

/** Blog tag filter options (client-safe — no server imports). */
export const BLOG_TAGS = ['Publishing', 'Strategy', 'AI', 'Teams', 'Growth', 'Product'] as const;

/** Soft pastel chip per tag: light fill, dark ink for contrast on both themes. */
export const BLOG_TAG_STYLES: Record<Category, string> = {
  Publishing: 'bg-[#FDF3D7] text-[#7A5A00]',
  Strategy: 'bg-[#E4F2E5] text-[#2F5D33]',
  AI: 'bg-[#EDE7FB] text-[#4B3B8F]',
  Teams: 'bg-[#E3EDF9] text-[#2B4E7E]',
  Growth: 'bg-[#FCE9DC] text-[#8A4B22]',
  Product: 'bg-[#F9E4EC] text-[#8A3358]',
};

export function blogTagClass(tag: Category): string {
  return BLOG_TAG_STYLES[tag] ?? 'bg-paper-dim text-ink';
}

/** Card outline that echoes each tag's pastel: yellow, green, violet and so on. */
export const BLOG_TAG_BORDERS: Record<Category, string> = {
  Publishing: '#E8C547',
  Strategy: '#8FC49B',
  AI: '#A998E0',
  Teams: '#8FB4DF',
  Growth: '#EDAE7E',
  Product: '#E295B4',
};

export function blogTagBorder(tag: Category): string {
  return BLOG_TAG_BORDERS[tag] ?? 'var(--color-line)';
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  /** ISO date — used for ordering, display and sitemap lastmod. */
  date: string;
  tag: Category;
  minutes: number;
  body: Block[];
  /** Pre-serialized HTML from the editor — null for legacy posts. */
  bodyHtml: string | null;
  /** Cover thumbnail (public blog-media URL) — null when unset. */
  coverUrl: string | null;
  coverAlt: string | null;
  /** Show the cover on the homepage News cards. Defaults true. */
  showCoverHome: boolean;
}

export type ResourceKind = 'Guide' | 'Playbook' | 'Template' | 'Glossary' | 'Cheat sheet';

export interface Resource {
  slug: string;
  title: string;
  description: string;
  kind: ResourceKind;
  minutes: number;
  body: Block[];
}

export interface ChannelGuide {
  key: ProviderKey;
  name: string;
  tagline: string;
  intro: string;
  limit: number;
  bestFor: string[];
  facts: { label: string; value: string }[];
  tips: { title: string; body: string }[];
  pitfalls: string[];
  faqs: { q: string; a: string }[];
}

export function blogHref(slug: string) {
  return `/blog/${slug}`;
}

export function resourceHref(slug: string) {
  return `/resources/${slug}`;
}

export function channelHref(key: string) {
  return `/integrations/${key}`;
}

/** Long-form dates: "12 March 2026". */
export function formatPostDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
