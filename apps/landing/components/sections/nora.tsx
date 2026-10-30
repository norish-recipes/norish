import { links } from "@/lib/css-tokens";
import { BookOpenIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

import { button } from "../button";
import { NoraStack } from "../nora-stack";

export function Nora() {
  return (
    <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-16 px-4 pb-28 sm:px-10">
      <div className="reveal reveal-left flex min-w-0 flex-1 basis-[25rem] flex-col gap-5">
        <h2 className="text-[clamp(3rem,6vw,5rem)] leading-none font-semibold tracking-[-0.022em]">
          Nora <span className="text-accent-text">+ dish.</span>
        </h2>
        <p className="text-muted max-w-[34ch] text-[1.1875rem] text-pretty">
          Norish is named after our dog. It also sounds like nourish.
        </p>
        <div className="border-border mt-7 flex flex-col gap-3.5 border-t pt-7">
          <h3 className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.022em]">
            Contributions <span className="text-accent-text">welcome</span>
          </h3>
          <p className="text-muted max-w-[40ch] text-[1.0625rem] text-pretty">
            No programming skills? Opening an issue helps make Norish a better app too.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-3">
            <a className={button.secondary} href={links.contributing}>
              <BookOpenIcon />
              Contributing guide
            </a>
            <a className={button.secondary} href={links.issues}>
              <ExclamationCircleIcon />
              Open an issue
            </a>
          </div>
        </div>
      </div>
      <NoraStack />
    </section>
  );
}
