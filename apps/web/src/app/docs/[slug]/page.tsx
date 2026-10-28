import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DocsArticle from '@/components/docs/DocsArticle';
import { buildNav, docsContent, flatPages } from '@/lib/docs';
import { seo } from '@/lib/seo';
import DocsJsonLd from '@/components/docs/DocsJsonLd';
import { markdownToPlain, renderDocMarkdown } from '@/lib/docsMarkdown';
import { legalChangelogMarkdown } from '@/lib/docsLegal';
import { sitePageHtml } from '@/lib/sitePages';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { sections, pages } = await docsContent();
  const page = pages.find((p) => p.slug === slug);
  if (!page) return { title: 'Page not found', robots: { index: false } };
  const section = sections.find((s) => s.id === page.sectionId);
  const brand = page.icon.startsWith('brand:') ? page.icon.slice(6) : undefined;
  return seo({
    path: `/${page.slug}`,
    // Channel pages answer "how do I connect X", so the title says that.
    title: brand ? `Connect ${page.title} to Sosial: setup and limits` : page.title,
    description: brand
      ? `${page.description} How to connect ${page.title} to Sosial step by step, plus its text and media limits.`
      : page.description || markdownToPlain(page.bodyMd),
    kicker: section?.title ?? 'Docs',
    cardTitle: page.title,
    channel: brand,
    type: 'article',
    modifiedTime: page.updatedAt ?? undefined,
    suffix: ' · Sosial Docs',
    siteName: 'Sosial Docs',
  });
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
  // two copies always match; the changelog still follows the override.
  const cms = page.sectionId === 'legal' ? await sitePageHtml(slug) : null;
  const override =
    cms && (slug === 'terms' || slug === 'privacy') ? cms + renderDocMarkdown(legalChangelogMarkdown(slug)).html : null;
  const sectionTitle = sections.find((s) => s.id === page.sectionId)?.title ?? '';
  return (
    <>
      <DocsJsonLd page={page} section={sectionTitle} />
      <DocsArticle
        htmlOverride={override}
        page={page}
        section={sectionTitle}
        prev={i > 0 ? flat[i - 1] : null}
        next={i >= 0 && i < flat.length - 1 ? flat[i + 1] : null}
      />
    </>
  );
}
