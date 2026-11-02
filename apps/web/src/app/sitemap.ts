import type { MetadataRoute } from 'next';
import { allArticles } from '@/lib/blog';
import { CHANNEL_GUIDES } from '@/content/channels';
import { allResources } from '@/content/resources';
import { allCustomPages } from '@/lib/sitePages';
import { LOCALES } from '@/lib/i18n/locales';
import { hreflangAlternates, localizedPath } from '@/lib/i18n/routing';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app';

/**
 * sosial.app/sitemap.xml. lastModified is only set where a real edit date
 * exists (posts, CMS pages); a "now" stamp on every request would tell
 * crawlers that nothing is ever stable. Terms and Privacy are left out: their
 * canonical copies are on docs.sosial.app, which has its own sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Translated pages: one entry per locale URL, each listing all of them.
  const localized: MetadataRoute.Sitemap = (
    [
      ['/', 'weekly', 1],
      ['/pricing', 'monthly', 0.9],
      ['/integrations', 'weekly', 0.8],
      ['/features', 'monthly', 0.7],
      ['/publish', 'monthly', 0.7],
      ['/features/create', 'monthly', 0.7],
      ['/ai-assistant', 'monthly', 0.7],
      ['/compare', 'monthly', 0.6],
      ['/made-for-everyone', 'yearly', 0.5],
      ['/transparency', 'yearly', 0.4],
    ] as const
  ).flatMap(([path, changeFrequency, priority]) =>
    LOCALES.map((l) => ({
      url: `${BASE}${localizedPath(path, l)}`,
      changeFrequency,
      priority,
      alternates: { languages: hreflangAlternates(path, BASE) },
    })),
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/blog`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/resources`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/about`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE}/delete-data`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const posts: MetadataRoute.Sitemap = (await allArticles()).map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(`${a.date}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.6,
    images: [a.coverUrl, `${BASE}/blog/${a.slug}/opengraph-image`].filter((x): x is string => !!x),
  }));

  const resources: MetadataRoute.Sitemap = allResources().map((r) => ({
    url: `${BASE}/resources/${r.slug}`,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  const channels: MetadataRoute.Sitemap = CHANNEL_GUIDES.map((c) => ({
    url: `${BASE}/integrations/${c.key}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const custom: MetadataRoute.Sitemap = (await allCustomPages()).map((p) => ({
    url: `${BASE}/${p.slug}`,
    ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [...localized, ...staticRoutes,...channels, ...posts, ...resources, ...custom];
}
