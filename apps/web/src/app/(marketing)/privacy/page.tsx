import type { Metadata } from 'next';
import LegalView from '@/components/site/LegalView';
import { formatPageDate, sitePageHtml, sitePageMeta } from '@/lib/sitePages';
import { PRIVACY } from '@/content/legal';

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('privacy');
  return {
    title: meta?.metaTitle ?? meta?.title ?? 'Privacy Policy',
    description: meta?.metaDescription ?? PRIVACY.summary,
    alternates: { canonical: '/privacy' },
  };
}

/** CMS edits go live within minutes. */
export const revalidate = 300;

export default async function PrivacyPage() {
  const meta = await sitePageMeta('privacy');
  const cmsHtml = await sitePageHtml('privacy');
  const date = formatPageDate(meta?.publishedAt ?? null);
  return (
    <LegalView
      doc={PRIVACY}
      cmsHtml={cmsHtml}
      title={meta?.title}
      updated={date}
      summary={meta?.metaDescription}
    />
  );
}
