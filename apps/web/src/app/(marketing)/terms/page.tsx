import type { Metadata } from 'next';
import LegalView from '@/components/site/LegalView';
import { sitePageHtml } from '@/lib/sitePages';
import { TERMS } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: TERMS.summary,
  alternates: { canonical: '/terms' },
};

/** CMS edits go live within minutes. */
export const revalidate = 300;

export default async function TermsPage() {
  const cmsHtml = await sitePageHtml('terms');
  return <LegalView doc={TERMS} cmsHtml={cmsHtml} />;
}
