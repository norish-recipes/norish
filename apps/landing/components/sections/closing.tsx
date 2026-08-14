import { links } from "@/lib/css-tokens";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

import { Action } from "../action";
import { Drift } from "../drift";
import { Mark } from "../marks";
import { Reveal } from "../reveal";
import { SteamedN } from "../steamed-n";

export function Closing() {
  return (
    <section className="border-border relative border-t px-5 py-28 sm:px-8 sm:py-36">
      <Drift>
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
          <Mark at="top-[22%] left-[11%] size-11" depth={1.3} shape="sprig" turn={14} />
          <Mark
            at="top-[28%] right-[13%] size-11"
            delay={160}
            depth={-1.1}
            shape="pear"
            turn={17}
          />
          <Mark
            at="bottom-[17%] left-[21%] size-10"
            delay={300}
            depth={-1.5}
            shape="tomato"
            turn={19}
          />
          <Mark
            at="right-[23%] bottom-[21%] size-10"
            delay={420}
            depth={1.6}
            shape="mushroom"
            turn={12}
          />
        </div>

        <Reveal className="mx-auto max-w-xl text-center">
          {/* The one place the mark stands alone: dinner is on. */}
          <SteamedN className="text-accent mx-auto h-16 w-auto" />
          <h2 className="mt-5 font-serif text-4xl leading-tight font-medium text-balance sm:text-5xl">
            Keep your recipes yours.
          </h2>
          <p className="text-muted mx-auto mt-5 max-w-md text-pretty">
            A few minutes to set up, and everyone you cook with has one clean place to cook from.
          </p>
          <div className="mt-9 flex items-center justify-center gap-2">
            <Action href="#self-host">Get started</Action>
            <Action external href={links.docs} variant="secondary">
              Documentation
              <ArrowUpRightIcon className="size-3.5" />
            </Action>
          </div>
        </Reveal>
      </Drift>
    </section>
  );
}
