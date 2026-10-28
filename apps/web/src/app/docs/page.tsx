import type { Metadata } from 'next';
import DocsHome from '@/components/docs/DocsHome';
import { buildNav, docsContent, flatPages } from '@/lib/docs';

export const metadata: Metadata = {
  title: { absolute: 'Sosial Docs' },
  alternates: { canonical: '/' },
};

/** docs.sosial.app home: a landing page, not an article (no sidebar). */
export default async function DocsHomePage() {
  const { sections, pages } = await docsContent();
  // Reading order, so every list on the home follows the sidebar.
  const order = new Map(flatPages(buildNav(sections, pages)).map((p, i) => [p.slug, i]));
  const ordered = pages
    .filter((p) => order.has(p.slug))
    .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  return <DocsHome sections={sections} pages={ordered} />;
}
