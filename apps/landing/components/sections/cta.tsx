import { ArrowRightIcon } from "@heroicons/react/24/outline";

import { CTAButton } from "../cta-button";
import { GitHubIcon } from "../icons";
import { Reveal } from "../motion/reveal";

import { links } from "@/lib/css-tokens";

export function CTA() {
  return (
    <section className="px-4 py-24 sm:py-32">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          <span className="text-accent">Norish</span> every meal.
        </h2>
        <p className="text-muted mx-auto mt-5 max-w-lg text-pretty">
          Spin up your own Norish in minutes and give everyone you cook for one calm, beautiful
          place to cook from, together.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CTAButton className="w-full sm:w-auto" href="#self-host" size="lg">
            Get started
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </CTAButton>
          <CTAButton
            external
            className="w-full sm:w-auto"
            href={links.github}
            size="lg"
            variant="secondary"
          >
            <GitHubIcon className="size-4.5" />
            Star on GitHub
          </CTAButton>
        </div>
      </Reveal>
    </section>
  );
}
