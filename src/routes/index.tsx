import { createFileRoute } from "@tanstack/react-router";

import { Nav } from "~/components/Nav";
import { HeroSection } from "~/components/HeroSection";
import { FeatureCards } from "~/components/FeatureCards";
import { WhyChoose } from "~/components/WhyChoose";
import { HowItWorks } from "~/components/HowItWorks";
import { FinalCTA } from "~/components/FinalCTA";
import { Footer } from "~/components/Footer";
import { FloralDivider } from "~/components/FloralDivider";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-dvh">
      <Nav />
      <main>
        <HeroSection />
        <FloralDivider />
        <FeatureCards />
        <FloralDivider />
        <WhyChoose />
        <FloralDivider />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}