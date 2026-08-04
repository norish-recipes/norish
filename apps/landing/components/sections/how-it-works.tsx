import type { ComponentType, SVGProps } from "react";
import { CalendarDaysIcon, FireIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { Reveal } from "../motion/reveal";
import { Stagger, StaggerItem } from "../motion/stagger";

type Step = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    icon: SparklesIcon,
    title: "Import",
    description:
      "Paste a link from any website or app and it's imported in seconds, no retyping. Add AI to pull from photos and videos too.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Plan",
    description:
      "Drop meals onto a calendar your whole household shares, and build a grocery list everyone keeps in sync.",
  },
  {
    icon: FireIcon,
    title: "Cook",
    description:
      "Open cooking mode for big, glanceable steps with timers and scaled quantities, from prep to plate.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-surface-secondary/30 scroll-mt-24 px-4 py-20 sm:py-28" id="how">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-accent text-sm font-semibold tracking-wide uppercase">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            From link to dinner in three steps
          </h2>
        </Reveal>

        <Stagger className="relative mt-14 grid gap-8 sm:grid-cols-3">
          {/* connecting line */}
          <div
            aria-hidden
            className="via-border absolute top-6 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent to-transparent sm:block"
          />
          {steps.map(({ icon: Icon, title, description }, i) => (
            <StaggerItem key={title} className="relative text-center">
              <div className="bg-accent text-accent-foreground ring-background shadow-accent/60 mx-auto grid size-12 place-items-center rounded-2xl shadow-[0_12px_30px_-12px] ring-8">
                <Icon className="size-5.5" />
              </div>
              <p className="text-muted mt-4 font-mono text-xs tracking-widest">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{title}</h3>
              <p className="text-muted mx-auto mt-2 max-w-xs text-sm text-pretty">{description}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
