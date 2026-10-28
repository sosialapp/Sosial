import { JsonLd } from '@/components/site/JsonLd';
import { docsUrl, type DocsPage } from '@/lib/docs';
import { SITE_URL } from '@/lib/seo';

/** TechArticle + breadcrumb trail for one docs page (docs.sosial.app). */
export default function DocsJsonLd({ page, section }: { page: DocsPage; section: string }) {
  const base = docsUrl();
  const url = `${base}/${page.slug}`;
  return (
    <JsonLd
      id="ld-docs"
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'TechArticle',
            headline: page.title,
            description: page.description || undefined,
            url,
            mainEntityOfPage: url,
            inLanguage: 'en',
            ...(page.updatedAt ? { dateModified: page.updatedAt } : {}),
            ...(section ? { articleSection: section } : {}),
            image: `${base}/og?t=${encodeURIComponent(page.title)}`,
            author: { '@type': 'Organization', name: 'Sosial', url: SITE_URL },
            publisher: {
              '@type': 'Organization',
              '@id': `${SITE_URL}/#organization`,
              name: 'Sosial',
              logo: { '@type': 'ImageObject', url: `${SITE_URL}/bolt.png` },
            },
            about: { '@id': `${SITE_URL}/#app` },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Docs', item: `${base}/` },
              ...(section ? [{ '@type': 'ListItem', position: 2, name: section }] : []),
              { '@type': 'ListItem', position: section ? 3 : 2, name: page.title, item: url },
            ],
          },
        ],
      }}
    />
  );
}
