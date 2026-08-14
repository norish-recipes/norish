import type { CSSProperties } from "react";
import { links } from "@/lib/css-tokens";

import { Action } from "../action";
import { Drift } from "../drift";
import { GitHubIcon } from "../icons";
import { Mark } from "../marks";
import { Reveal } from "../reveal";
import { SourceFlow } from "../source-flow";

export function Hero() {
  return (
    <section className="relative px-5 pt-32 pb-20 sm:px-8 sm:pt-40 sm:pb-28" id="top">
      <div
        aria-hidden
        className="hero-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-160"
      />

      <Drift>
        {/* Only where there is margin to spare: on a phone the copy fills the
            width and there is nowhere for one to sit that is not in the way. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
          <Mark at="top-[25%] left-[6%] size-11" depth={1.2} shape="lemon" turn={15} />
          <Mark at="top-[18%] right-[8%] size-10" delay={200} depth={-1} shape="sprig" turn={12} />
          <Mark
            at="bottom-[13%] left-[10%] size-11"
            delay={340}
            depth={-1.4}
            shape="mushroom"
            turn={17}
          />
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h1 className="font-serif text-[2.75rem] leading-[1.05] font-medium text-balance sm:text-6xl">
              Any recipe, any source.
            </h1>
          </Reveal>

          <Reveal delay={90}>
            <p className="text-muted mx-auto mt-6 max-w-lg text-base leading-relaxed text-pretty sm:text-lg">
              A link, video, photo, or plain text. Norish reads it and turns it into a clean, structured
              recipe for you and everyone you cook with.
            </p>
          </Reveal>

          <Reveal delay={170}>
            <div className="mt-9 flex items-center justify-center gap-2">
              <Action href="#self-host">Get started</Action>
              <Action external href={links.github} variant="secondary">
                <GitHubIcon className="size-4" />
                GitHub
              </Action>
            </div>
          </Reveal>
        </div>

        {/* Two equal halves, so the seam between them — where the strands all
            meet — is the middle of the page. The sources need less than their
            half and sit against the seam; the width here is set by the half
            the recipe wants, not by the half the sources want. */}
        <Reveal className="mx-auto mt-16 max-w-3xl sm:mt-20 md:max-w-4xl lg:max-w-6xl" delay={250}>
          <div className="parallax" style={{ "--depth": 0.5 } as CSSProperties}>
            <SourceFlow />
          </div>
        </Reveal>
      </Drift>
    </section>
  );
}
