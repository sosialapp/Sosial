import type { Metadata } from 'next';
import { FaqList } from '@/components/site/PageBlocks';
import PageCms from '@/components/site/PageCms';
import PricingPlans from '@/components/PricingPlans';
import PlanComparison from '@/components/PlanComparison';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';
import { getLocale } from '@/lib/i18n/server';
import { translator } from '@/lib/i18n/locales';
import { appMessages } from '@/lib/i18n/app';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await sitePageMeta('pricing');
  const t = translator(appMessages, await getLocale());
  return {
    title: meta?.metaTitle ?? meta?.title ?? t('prTitle'),
    description: meta?.metaDescription ?? t('prMetaDesc'),
    alternates: { canonical: '/pricing' },
  };
}

export default async function PricingPage() {
  const meta = await sitePageMeta('pricing');
  const date = formatPageDate(meta?.publishedAt ?? null);
  const t = translator(appMessages, await getLocale());
  return (
    <>
      <PricingPlans
        title={meta?.title ?? t('prTitle')}
        lede={t('prLede')}
        updated={date ?? undefined}
      />

      <PageCms slug="pricing" className="mx-auto max-w-3xl px-4 py-16 md:py-20" />

      <PlanComparison />

      <FaqList
        items={[
          { q: t('prFaq1Q'), a: t('prFaq1A') },
          { q: t('prFaq2Q'), a: t('prFaq2A') },
          { q: t('prFaq3Q'), a: t('prFaq3A') },
          { q: t('prFaq4Q'), a: t('prFaq4A') },
          { q: t('prFaq5Q'), a: t('prFaq5A') },
          { q: t('prFaq6Q'), a: t('prFaq6A') },
          { q: t('prFaq7Q'), a: t('prFaq7A') },
        ]}
      />
    </>
  );
}
