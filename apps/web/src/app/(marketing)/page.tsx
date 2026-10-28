import Hero from '@/components/landing/Hero';
import ProductBento from '@/components/landing/ProductBento';
import LogoDock from '@/components/landing/LogoDock';
import ChannelTable from '@/components/landing/ChannelTable';
import Faq from '@/components/landing/Faq';

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
