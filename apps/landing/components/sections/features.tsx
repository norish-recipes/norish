import type { ReactNode } from "react";

import type { ShotName } from "../shot";
import { Shot } from "../shot";

function Title({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <h3 className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.022em] sm:text-[2rem]">
      {children} <span className="text-accent">{accent}</span>
    </h3>
  );
}

function Phone({ base, alt, className }: { base: ShotName; alt: string; className: string }) {
  return <Shot alt={alt} base={base} className={`phone ${className}`} sizes="18rem" />;
}

/** A bento of what the household does with it, each tile wearing one of the app's own hues. */
export function Features() {
  return (
    <section className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-10" id="features">
      <div className="bento">
        <article className="tile tile-plan tint-orange sm:flex-row sm:gap-8">
          <div className="flex flex-1 flex-col gap-3 pt-2">
            <Title accent="the week">Plan</Title>
            <p className="max-w-[30ch] text-[1.0625rem]">
              One meal calendar for the household, optionally synced over CalDAV.
            </p>
          </div>
          <Phone
            alt="The meal calendar on a phone"
            base="calendar-mobile"
            className="phone-crop mx-auto mt-4 w-[min(80%,17.5rem)] sm:w-[min(44%,17.5rem)]"
          />
        </article>

        <article className="tile tile-groceries tint-blue">
          <Title accent="the groceries">Do</Title>
          <p className="text-[1.0625rem]">By store and aisle, with prices, synced in real time.</p>
          <Phone
            alt="The grocery list on a phone, with prices per line"
            base="groceries-mobile"
            className="mx-auto mt-auto mb-8 w-[90%] max-w-75"
          />
        </article>

        <article className="tile tile-pantry tint-green">
          <Title accent="the pantry">Skip</Title>
          <p>Pantry foods stay off the grocery list.</p>
          <Phone
            alt="The pantry on a phone"
            base="pantry-mobile"
            className="phone-crop mx-auto mt-5 w-[78%] max-w-72"
          />
        </article>

        <article className="tile tile-cooking tint-red">
          <Title accent="cooking">Focus on</Title>
          <p>Step timers, and the screen stays on.</p>
          <Phone
            alt="Cooking mode on a phone, one step at a time"
            base="cooking-mobile"
            className="phone-crop mx-auto mt-5 w-[78%] max-w-72"
          />
        </article>

        <article className="tile tile-recipe bg-surface ring-border pb-8 ring-1 ring-inset md:flex-row md:items-center md:gap-10">
          <div className="flex flex-col gap-3 md:w-80 md:shrink-0">
            <Title accent="that works">A recipe page</Title>
            <p className="text-[1.0625rem]">Remove the clutter, and focus on the recipe at hand.</p>
          </div>
          <Shot
            alt="A Greek Yogurt Naan recipe scaled to 16 servings, with nutrition worked out from the ingredients"
            base="recipe-web"
            className="ring-border mt-4 block h-auto w-full min-w-0 rounded-[1.25rem] ring-1 md:mt-0"
            sizes="(min-width: 72rem) 44rem, 90vw"
          />
        </article>
      </div>
    </section>
  );
}
