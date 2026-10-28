import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { docsUrl } from '@/lib/site';
import LegalView from '@/components/site/LegalView';
import { formatPageDate, sitePageHtml, sitePageMeta } from '@/lib/sitePages';
import { TERMS } from '@/content/legal';

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('terms');
  return seo({
    // The docs copy is canonical; this URL stays live for the platform app reviews that link it.
    path: `${docsUrl()}/terms`,
    title: meta?.metaTitle ?? meta?.title ?? 'Terms of Use',
    description: meta?.metaDescription ?? TERMS.summary,
    kicker: 'Legal',
  });
}

/** CMS edits go live within minutes. */
export const revalidate = 300;

export default async function TermsPage() {
  const meta = await sitePageMeta('terms');
  const cmsHtml = await sitePageHtml('terms');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <LegalView
      doc={TERMS}
      cmsHtml={cmsHtml}
      title={meta?.title}
      updated={date}
      summary={meta?.metaDescription}
    />
  );
}
