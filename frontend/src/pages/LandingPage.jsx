import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import Strategies from '../components/landing/Strategies';
import CTA from '../components/landing/CTA';

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
