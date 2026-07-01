import Hero from '../../components/landing/Hero/Hero';
import Features from '../../components/landing/Features/Features';
import HowItWorks from '../../components/landing/HowItWorks/HowItWorks';
import Strategies from '../../components/landing/Strategies/Strategies';
import CTA from '../../components/landing/CTA/CTA';

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <Strategies />
      <CTA />
    </main>
  );
}
