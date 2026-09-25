import type { Metadata } from 'next';
import LegalView from '@/components/site/LegalView';
import { sitePageHtml } from '@/lib/sitePages';
import { PRIVACY } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: PRIVACY.summary,
  alternates: { canonical: '/privacy' },
};

/** CMS edits go live within minutes. */
export const revalidate = 300;

export default async function PrivacyPage() {
  const cmsHtml = await sitePageHtml('privacy');
  return <LegalView doc={PRIVACY} cmsHtml={cmsHtml} />;
}
