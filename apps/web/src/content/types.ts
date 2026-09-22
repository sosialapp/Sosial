import type { ProviderKey } from '@/lib/types';

export type Block =
  | { t: 'p'; c: string }
  | { t: 'h'; c: string }
  | { t: 'ul'; c: string[] }
  | { t: 'quote'; c: string }
  | { t: 'img'; c: string; alt?: string; caption?: string }
  | { t: 'video'; c: string };

export type Category = 'Publishing' | 'Strategy' | 'AI' | 'Teams' | 'Growth' | 'Product';

/** Blog tag filter options (client-safe — no server imports). */
export const BLOG_TAGS = ['Publishing', 'Strategy', 'AI', 'Teams', 'Growth', 'Product'] as const;

export interface Article {
  slug: string;
  title: string;
  description: string;
  /** ISO date — used for ordering, display and sitemap lastmod. */
  date: string;
  tag: Category;
  minutes: number;
  body: Block[];
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
