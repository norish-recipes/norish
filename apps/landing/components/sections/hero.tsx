import { links } from "@/lib/css-tokens";
import { BookOpenIcon, CommandLineIcon } from "@heroicons/react/24/outline";

import { button } from "../button";
import { Shot } from "../shot";

/** The household's week in hand: tonight's recipe, with the calendar and the list fanned behind it. */
export function Hero() {
  return (
    <section className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 pt-32 text-center sm:px-10 sm:pt-36">
      <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-none font-semibold tracking-[-0.022em] text-balance">
        Dinner, sorted <span className="text-accent-text">together.</span>
      </h1>
      <p className="text-muted text-xl text-balance">
        One recipe app for the whole household to enjoy.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a className={button.primary} href="#self-host">
          <CommandLineIcon />
          Self-host it
        </a>
        <a className={button.secondary} href={links.docs}>
          <BookOpenIcon />
          Read the docs
        </a>
      </div>

      <div className="phones relative mt-8 flex w-full max-w-[57.5rem] justify-center pb-20">
        <Shot
          alt=""
          base="calendar-mobile"
          className="phone fan fan-left absolute top-[4.5rem] left-[5%] w-[29%] max-w-[17rem]"
          sizes="17rem"
        />
        <Shot
          alt=""
          base="groceries-mobile"
          className="phone fan fan-right absolute top-[4.5rem] right-[5%] w-[29%] max-w-[17rem]"
          sizes="17rem"
        />
        <Shot
          eager
          alt="The Steak Bowls recipe in Norish on a phone, with the meal calendar and grocery list beside it"
          base="recipe-mobile"
          className="phone relative w-[35%] max-w-80 min-w-56"
          sizes="20rem"
        />
      </div>
    </section>
  );
}
