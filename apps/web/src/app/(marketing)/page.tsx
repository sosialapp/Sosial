import Hero from '@/components/landing/Hero';
import ProofStrip from '@/components/landing/ProofStrip';
import FeaturesBento from '@/components/landing/FeaturesBento';
import TeamSection from '@/components/landing/TeamSection';
import FreeSection from '@/components/landing/FreeSection';
import StepsSection from '@/components/landing/StepsSection';
import SafetySection from '@/components/landing/SafetySection';
import FinalCta from '@/components/landing/FinalCta';

/** Landing: Tenner architecture — fold, proof, bento, team, free, steps, safety, band. */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <FeaturesBento />
      <TeamSection />
      <FreeSection />
      <StepsSection />
      <SafetySection />
      <FinalCta />
    </>
  );
}
