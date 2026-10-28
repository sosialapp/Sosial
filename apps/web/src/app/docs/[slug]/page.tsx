import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DocsArticle from '@/components/docs/DocsArticle';
import { buildNav, docsContent, docsPage, flatPages } from '@/lib/docs';
import { markdownToPlain, renderDocMarkdown } from '@/lib/docsMarkdown';
import { legalChangelogMarkdown } from '@/lib/docsLegal';
import { sitePageHtml } from '@/lib/sitePages';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await docsPage(slug);
  if (!page) return { title: 'Page not found', robots: { index: false } };
  const description = page.description || markdownToPlain(page.bodyMd).slice(0, 160);
  return {
    title: page.title,
    description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { type: 'article', title: page.title, description, url: `/${page.slug}` },
    twitter: { card: 'summary', title: page.title, description },
  };
}

/** One page at docs.sosial.app/<slug>. */
export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sections, pages } = await docsContent();
  const page = pages.find((p) => p.slug === slug);
  if (!page) notFound();
  const flat = flatPages(buildNav(sections, pages));
  const i = flat.findIndex((p) => p.slug === slug);
  // Legal pages follow a CMS override of sosial.app/terms or /privacy, so the
  // two copies always match.
  // The changelog still follows the override.
  const cms = page.sectionId === 'legal' ? await sitePageHtml(slug) : null;
  const override =
    cms && (slug === 'terms' || slug === 'privacy') ? cms + renderDocMarkdown(legalChangelogMarkdown(slug)).html : null;
  return (
    <DocsArticle
      htmlOverride={override}
      page={page}
      section={sections.find((s) => s.id === page.sectionId)?.title ?? ''}
      prev={i > 0 ? flat[i - 1] : null}
      next={i >= 0 && i < flat.length - 1 ? flat[i + 1] : null}
    />
  );
}
