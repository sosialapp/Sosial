import type { MetadataRoute } from 'next';
import { buildNav, docsContent, docsUrl, flatPages } from '@/lib/docs';

// Admin saves purge it (revalidatePath on /docs), this is the fallback.
export const revalidate = 3600;

/** docs.sosial.app/sitemap.xml (the middleware maps it onto /docs/sitemap.xml). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = docsUrl();
  const { sections, pages } = await docsContent();
  const updated = new Map(pages.map((p) => [p.slug, p.updatedAt]));
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    ...flatPages(buildNav(sections, pages)).map((p) => {
      const at = updated.get(p.slug);
      return {
        url: `${base}/${p.slug}`,
        lastModified: at ? new Date(at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      };
    }),
  ];
}
