import type { Metadata } from 'next';
import LegalView from '@/components/site/LegalView';
import { TERMS } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: TERMS.summary,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <LegalView doc={TERMS} />;
}
