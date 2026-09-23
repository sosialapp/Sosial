import type { MetadataRoute } from 'next';
import { allArticles } from '@/lib/blog';
import { CHANNEL_GUIDES } from '@/content/channels';
import { allResources } from '@/content/resources';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/integrations`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/publish`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/features/create`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/ai-assistant`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/resources`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/made-for-everyone`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE}/transparency`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const posts: MetadataRoute.Sitemap = (await allArticles()).map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(`${a.date}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const resources: MetadataRoute.Sitemap = allResources().map((r) => ({
    url: `${BASE}/resources/${r.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  const channels: MetadataRoute.Sitemap = CHANNEL_GUIDES.map((c) => ({
    url: `${BASE}/integrations/${c.key}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...channels, ...posts, ...resources];
}
