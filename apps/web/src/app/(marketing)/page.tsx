import Hero from '@/components/landing/Hero';
import ProductBento from '@/components/landing/ProductBento';
import LogoDock from '@/components/landing/LogoDock';
import Faq from '@/components/landing/Faq';

/** Landing: fold, interactive Create / Publish / Team bento, logo dock, FAQ. */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProductBento />
      <LogoDock />
      <Faq />
    </>
  );
}
