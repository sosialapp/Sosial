import Hero from '@/components/landing/Hero';
import ProofStrip from '@/components/landing/ProofStrip';
import FeaturesBento from '@/components/landing/FeaturesBento';
import TeamSection from '@/components/landing/TeamSection';
import StepsSection from '@/components/landing/StepsSection';
import SafetySection from '@/components/landing/SafetySection';

/** Landing: Tenner architecture — fold, proof, bento, team, steps, safety. */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <FeaturesBento />
      <TeamSection />
      <StepsSection />
      <SafetySection />
    </>
  );
}
