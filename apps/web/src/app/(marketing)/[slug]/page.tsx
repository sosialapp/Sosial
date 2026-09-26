import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHero } from '@/components/site/PageBlocks';
import ChartIslands from '@/components/site/ChartIslands';
import { siteCustomPage, siteRedirectFor } from '@/lib/sitePages';
import { RESERVED_SLUGS, sitePageDef } from '@/content/sitePages';

/**
 * Custom CMS pages — admin-created slugs served at top-level URLs.
 * Static and registry routes win over this dynamic segment by Next.js
 * precedence; the guards below are a second lock. Renamed slugs 301 via
 * site_redirects; drafts and scheduled-future rows 404 until due.
 */

/** CMS edits go live within minutes. */
export const revalidate = 300;

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (sitePageDef(slug) || RESERVED_SLUGS.has(slug)) return {};
  const page = await siteCustomPage(slug);
  if (!page) return {};
  return {
    title: page.metaTitle ?? page.title ?? slug,
    description: page.metaDescription ?? undefined,
    alternates: { canonical: `/${slug}` },
  };
}

export default async function CustomSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (sitePageDef(slug) || RESERVED_SLUGS.has(slug)) notFound();

  const to = await siteRedirectFor(slug);
  if (to) redirect(`/${to}`);

  const page = await siteCustomPage(slug);
  if (!page) notFound();

  const title = page.title ?? slug;
  const date = fmtDate(page.publishedAt);

  return (
    <>
      <PageHero
        eyebrow="Sosial"
        title={title}
        lede={date ? `Published ${date}.` : 'From the Sosial team.'}
        secondary={{ href: '/pricing', label: 'Published prices' }}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <div className="prose-sosial blog-rich" dangerouslySetInnerHTML={{ __html: page.bodyHtml ?? '' }} />
        <ChartIslands />
      </div>
    </>
  );
}
