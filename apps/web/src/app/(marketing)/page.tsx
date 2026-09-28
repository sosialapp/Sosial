import Hero from '@/components/landing/Hero';
import FeaturesBento from '@/components/landing/FeaturesBento';
import TeamSection from '@/components/landing/TeamSection';
import StepsSection from '@/components/landing/StepsSection';

/** Landing: Tenner architecture — fold, bento, team, steps. */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeaturesBento />
      <TeamSection />
      <StepsSection />
    </>
  );
}
