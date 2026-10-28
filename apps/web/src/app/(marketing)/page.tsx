import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import Hero from '@/components/landing/Hero';
import ProductBento from '@/components/landing/ProductBento';
import LogoDock from '@/components/landing/LogoDock';
import ChannelTable from '@/components/landing/ChannelTable';
import Faq from '@/components/landing/Faq';

export const metadata: Metadata = seo({
  path: '/',
  title: 'Sosial: social media scheduler for every channel',
  description:
    'Schedule posts to Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube and more from one composer, calendar and queue. AI writer and a free plan.',
  // The homepage card (app/opengraph-image) with the devices and channel logos.
  image: '/opengraph-image',
});

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
