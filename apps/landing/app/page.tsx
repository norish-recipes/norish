import { Navbar } from "@/components/navbar";
import { CTA } from "@/components/sections/cta";
import { FeatureGrid } from "@/components/sections/feature-grid";
import { Footer } from "@/components/sections/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { ScreenshotShowcase } from "@/components/sections/screenshot-showcase";
import { SelfHost } from "@/components/sections/self-host";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeatureGrid />
        <ScreenshotShowcase />
        <HowItWorks />
        <SelfHost />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
