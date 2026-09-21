import type { Metadata } from 'next';
import LegalView from '@/components/site/LegalView';
import { PRIVACY } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: PRIVACY.summary,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <LegalView doc={PRIVACY} />;
}
