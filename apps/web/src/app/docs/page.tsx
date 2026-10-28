import type { Metadata } from 'next';
import { SITE_URL, seo } from '@/lib/seo';
import { JsonLd } from '@/components/site/JsonLd';
import DocsHome from '@/components/docs/DocsHome';
import { buildNav, docsContent, docsUrl, flatPages } from '@/lib/docs';

export const metadata: Metadata = seo({
  path: '/',
  title: 'Sosial Docs: guides, channel setup and API',
  description:
    'How to use Sosial: connect Instagram, TikTok, X and 14 more channels, schedule posts, and automate publishing with the REST API and MCP server.',
  kicker: 'Docs',
  cardTitle: 'Everything you need to post everywhere with Sosial.',
  siteName: 'Sosial Docs',
});

/** docs.sosial.app home: a landing page, not an article (no sidebar). */
export default async function DocsHomePage() {
  const { sections, pages } = await docsContent();
  // Reading order, so every list on the home follows the sidebar.
  const order = new Map(flatPages(buildNav(sections, pages)).map((p, i) => [p.slug, i]));
  const ordered = pages
    .filter((p) => order.has(p.slug))
    .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  return (
    <>
      <JsonLd
        id="ld-docs-site"
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Sosial Docs',
          url: `${docsUrl()}/`,
          inLanguage: 'en',
          publisher: { '@id': `${SITE_URL}/#organization` },
          about: { '@id': `${SITE_URL}/#app` },
        }}
      />
      <DocsHome sections={sections} pages={ordered} />
    </>
  );
}
