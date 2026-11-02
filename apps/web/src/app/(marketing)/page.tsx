import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { landingMessages } from '@/lib/i18n/landing';
import { translator } from '@/lib/i18n/locales';
import { getLocale } from '@/lib/i18n/server';
import Hero from '@/components/landing/Hero';
import ProductBento from '@/components/landing/ProductBento';
import LogoDock from '@/components/landing/LogoDock';
import ChannelTable from '@/components/landing/ChannelTable';
import Faq from '@/components/landing/Faq';

/** Translated per locale; /es, /fr… are this page's locale URLs (lib/i18n/routing). */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(landingMessages, locale);
  return seo({
    path: '/',
    locale,
    title: t('metaTitle'),
    description: t('metaDesc'),
    // The homepage card (app/opengraph-image) with the devices and channel logos.
    image: '/opengraph-image',
  });
}

/** Landing: fold, interactive Create / Publish / Team bento, logo dock, channel table, FAQ. */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProductBento />
      <LogoDock />
      <ChannelTable />
      <Faq />
    </>
  );
}
