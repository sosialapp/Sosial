import type { Metadata } from 'next';

/**
 * One place that shapes a page's search and share metadata, so every public
 * page gets the same complete set: a title that fits Google's ~60 character
 * cut, a description inside 160, a canonical URL, Open Graph (with og:url and
 * a 1200×630 card) and a Twitter card.
 *
 * Paths are site-relative; `metadataBase` (sosial.app, or docs.sosial.app in
 * the docs layout) makes them absolute.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app').replace(/\/+$/, '');

const SUFFIX = ' · Sosial';
const TITLE_MAX = 60;
const DESC_MAX = 160;

/** Brand suffix only when it fits and the title doesn't already name Sosial. */
export function seoTitle(title: string, suffix = SUFFIX): string {
  const t = title.trim();
  if (/\bSosial\b/.test(t) || t.length + suffix.length > TITLE_MAX) return t;
  return `${t}${suffix}`;
}

/** Hard cap at 160 characters, cut on a word boundary. */
export function seoDescription(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= DESC_MAX) return t;
  const cut = t.slice(0, DESC_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '')}…`;
}

/** The generic share card (app/og): a headline, an optional kicker and channel logo. */
export function ogImagePath({ title, kicker, channel }: { title: string; kicker?: string; channel?: string }): string {
  const q = new URLSearchParams({ t: title });
  if (kicker) q.set('k', kicker);
  if (channel) q.set('c', channel);
  return `/og?${q.toString()}`;
}

export interface SeoInput {
  /** Site-relative canonical path, e.g. `/publish`. */
  path: string;
  /** Page title without the brand suffix. */
  title: string;
  description: string;
  /** Short label printed above the headline on the share card. */
  kicker?: string;
  /** Headline for the share card when it should differ from the title. */
  cardTitle?: string;
  /** Channel whose logo the share card shows. */
  channel?: string;
  /** An image URL, or false when the route has its own opengraph-image file. */
  image?: string | false;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  /** Brand suffix for the <title>; the docs use " · Sosial Docs". */
  suffix?: string;
  siteName?: string;
  noindex?: boolean;
}

export function seo(i: SeoInput): Metadata {
  const title = seoTitle(i.title, i.suffix);
  const description = seoDescription(i.description);
  const image =
    i.image === false ? null : i.image ?? ogImagePath({ title: i.cardTitle ?? i.title, kicker: i.kicker, channel: i.channel });
  const images = image ? [{ url: image, width: 1200, height: 630, alt: i.cardTitle ?? i.title }] : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: i.path },
    ...(i.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: i.type ?? 'website',
      url: i.path,
      siteName: i.siteName ?? 'Sosial',
      locale: 'en_US',
      title,
      description,
      ...(images ? { images } : {}),
      ...(i.type === 'article'
        ? { publishedTime: i.publishedTime, modifiedTime: i.modifiedTime ?? i.publishedTime }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(images ? { images: images.map((x) => x.url) } : {}),
    },
  };
}
