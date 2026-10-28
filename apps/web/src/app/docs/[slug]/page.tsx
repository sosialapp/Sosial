import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DocsArticle from '@/components/docs/DocsArticle';
import { buildNav, docsContent, docsPage, flatPages } from '@/lib/docs';
import { markdownToPlain } from '@/lib/docsMarkdown';

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
  return (
    <DocsArticle
      page={page}
      section={sections.find((s) => s.id === page.sectionId)?.title ?? ''}
      prev={i > 0 ? flat[i - 1] : null}
      next={i >= 0 && i < flat.length - 1 ? flat[i + 1] : null}
    />
  );
}
