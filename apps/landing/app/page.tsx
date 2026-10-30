import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { Nora } from "@/components/sections/nora";
import { SelfHost } from "@/components/sections/self-host";
import { Sources } from "@/components/sections/sources";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="top">
        <Hero />
        <Sources />
        <Features />
        <Nora />
        <SelfHost />
      </main>
    </>
  );
}
