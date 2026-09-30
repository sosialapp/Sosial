import Hero from '@/components/landing/Hero';
import LogoDock from '@/components/landing/LogoDock';
import FeaturesBento from '@/components/landing/FeaturesBento';
import TeamSection from '@/components/landing/TeamSection';

/** Landing: Tenner architecture — fold, dock, bento, team. */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <LogoDock />
      <FeaturesBento />
      <TeamSection />
    </>
  );
}
