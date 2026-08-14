"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";

import { Phone, Screen } from "../frames";
import { clamp, useScrollFrame } from "../scroll-frame";
import { asking, heldAt, walkAt } from "../sequence";
import { Shot } from "../shot";

type Screenful = {
  title: string;
  body: string;
  /** The two captures of one screen: the wide one, and the same on a phone. */
  web: "dashboard-web" | "recipe-web" | "cooking-web" | "calendar-web" | "groceries-web";
  mobile:
    | "dashboard-mobile"
    | "recipe-mobile"
    | "cooking-mobile"
    | "calendar-mobile"
    | "groceries-mobile";
  alt: string;
};

const screens: Screenful[] = [
  {
    title: "See all your recipes at a glance",
    body: "Have anything planned for the day, see it right on top. Underneath you can view all the recipes you ever saved.",
    web: "dashboard-web",
    mobile: "dashboard-mobile",
    alt: "The Norish home screen: today's planned meals above a searchable grid of saved recipes",
  },
  {
    title: "Customise it how you want",
    body: "Need to scale the recipe? Use the plus and minus icons for however many servings you need. Is the recipe is metric whilst you need US? Let Norish adjust the ingredients. ",
    web: "recipe-web",
    mobile: "recipe-mobile",
    alt: "A recipe page in Norish, with scaled ingredients beside the steps",
  },
  {
    title: "Need to focus?",
    body: "Open the cooking mode, and see the recipe one step at a time. The screen will remain on whilst you are in cooking mode, so no need to worry about your device turning off. ",
    web: "cooking-web",
    mobile: "cooking-mobile",
    alt: "Cooking mode in Norish: one step filling the screen, with the ingredients it uses beneath it",
  },
  {
    title: "Plan your week ahead",
    body: "Drop the recipes you woudl like to eat onto the calendar your whole household shares. Want to use your own calendar? Let Norish handle the syncing using CalDAV.",
    web: "calendar-web",
    mobile: "calendar-mobile",
    alt: "The Norish meal calendar, with planned meals on each day and today picked out",
  },
  {
    title: "A grocery list that learns",
    body: "Groceries that went into store 'Y' will go into store 'Y' the next time you need it. When doing groceries with your partner split up, the list stays in sync in realtime.",
    web: "groceries-web",
    mobile: "groceries-mobile",
    alt: "A shared Norish grocery list grouped by shop, with one group folded away and items ticked off",
  },
];

/** Where the two-column layout starts: copy beside the capture, not above it. */
const WIDE = "(min-width: 64rem)";

/**
 * How far down the screen a block comes to rest on the wide layout, matching
 * the `top` its copy sticks at. A block has arrived when it reaches this line,
 * and it holds there beside its capture until the next block pushes it off.
 */
const TRIGGER = 0.38;

/** The shorter handover of ghost to ink, so only one block is ever being read. */
const INK = 0.25;

/** The share of the held screen a move between two screens takes. */
const GLIDE = 0.08;

/**
 * How far the reader has come, counted in blocks: a whole number is a block at
 * the line, the fraction between two is the handover from one to the next. Read
 * straight off the geometry on a frame rather than from remembered offsets, so
 * it survives a resize, a zoom, and a browser restoring a scroll position in the
 * middle of the section.
 */
function reading(blocks: (HTMLLIElement | null)[]) {
  const line = window.innerHeight * TRIGGER;
  const tops = blocks.map((block) => block?.getBoundingClientRect().top ?? Infinity);
  let at = 0;

  for (let index = 0; index < tops.length; index += 1) {
    const top = tops[index];

    if (top === undefined || top > line) break;

    const next = tops[index + 1];

    at = next === undefined ? index : index + clamp((line - top) / (next - top));
  }

  return at;
}

/**
 * The same count on the held stage, where the screens are stacked rather than
 * laid down the page: the section's own progress, walked a screen at a time so
 * each one rests long enough to be read.
 */
function held(section: HTMLElement) {
  return walkAt(heldAt(section), screens.length, GLIDE);
}

/**
 * One screen, both shapes: the wide capture with the phone capture riding its
 * corner, because the point is that both are the same screen.
 */
function Capture({ screen }: { screen: Screenful }) {
  return (
    <div className="relative">
      <Screen>
        <Shot
          alt={screen.alt}
          base={screen.web}
          className="w-full"
          sizes="(min-width: 64rem) 42rem, 92vw"
        />
      </Screen>
      <Phone className="absolute -right-1 -bottom-4 w-[23%] sm:-right-2 sm:-bottom-5">
        <Shot
          alt=""
          base={screen.mobile}
          className="w-full"
          sizes="(min-width: 64rem) 10rem, 21vw"
        />
      </Phone>
    </div>
  );
}

/**
 * The app, a screen at a time, told the same way at both sizes: one screen is
 * being read, its capture is on the screen with it, and the scroll moves you
 * from one to the next. All of it is scrubbed by the scroll rather than played
 * on a timer, so it follows you exactly, both ways.
 *
 * Where there is room for two columns the copy walks down the page on the left
 * and the capture keeps up with it on the right. Where there is not, the
 * section holds the screen instead and the copy and the capture are pushed up
 * out of it together, a screen at a time.
 *
 * Which screen is up is the one thing that is not scrubbed: it is committed at
 * the halfway point between two blocks and the change then plays itself out,
 * because a screenshot scrubbed halfway into another screenshot is a blend of
 * two pictures and reads as neither; under reduced motion it is a cut.
 *
 * Adding a screen is one entry here plus its four captures, web and mobile in
 * both themes, registered in `components/shot.tsx`.
 */
export function Tour() {
  const stage = useRef<HTMLElement>(null);
  const blocks = useRef<(HTMLLIElement | null)[]>([]);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  useScrollFrame(() => {
    const section = stage.current;

    if (!section) return;

    const wide = asking(WIDE);
    const at = wide ? reading(blocks.current) : held(section);
    // Which screen is up is committed rather than scrubbed: it changes over at
    // the halfway point between two blocks and the swap then plays itself out
    // (see `.screen-layer` in globals.css). Scrubbing it means every position
    // between two screens is a blend of two screenshots, and a screenshot half
    // faded through another screenshot cannot be read at all.
    const showing = Math.round(at);

    // Where a screen sits relative to the one being shown: behind it once it
    // has been read, ahead of it while it is still to come.
    layers.current.forEach((layer, index) => {
      layer?.style.setProperty("--lit", `${Number(index === showing)}`);
      layer?.style.setProperty("--push", `${Math.sign(showing - index)}`);
    });

    // Beside its capture a block is in ink from the moment it reaches the line
    // until the next one takes over, which is a reading position rather than a
    // picture and stays scrubbed. Stacked over the capture there is only room
    // for one, so it commits along with the screen it belongs to.
    blocks.current.forEach((block, index) => {
      const lit = wide
        ? Math.min(clamp((at - index + INK) / INK), clamp((index + 1 - at) / INK))
        : Number(index === showing);

      // Which side of the reading a block sits on, and how far. Committed on
      // the held stage, where it is a push in one move; scrubbed beside a
      // capture, where a block sitting on the line would otherwise be held
      // there until the one behind it arrives to shove it off — the two are
      // touching at that moment. Read continuously, both are already pulling
      // apart, the one above rising and the one below hanging back, so the
      // line is clear well before they reach each other.
      block?.style.setProperty("--lit", `${lit}`);
      block?.style.setProperty(
        "--push",
        `${wide ? Math.max(-1, Math.min(1, at - index)) : Math.sign(showing - index)}`
      );
    });

    dots.current.forEach((dot, index) => {
      dot?.style.setProperty("--lit", `${Number(index === showing)}`);
    });
  });

  return (
    <section
      ref={stage}
      className="tour-stage border-border border-t"
      style={{ "--screens": `${screens.length}` } as CSSProperties}
    >
      <div className="tour-pin px-5 sm:px-8">
        {/* Two columns where there is room for them, and the copy stacked over
            the capture where there is not. The copy blocks own their stretch of
            scroll on the wide layout and sit on top of one another on the held
            one; `--lit` says which of them is being read either way. */}
        <div className="tour-grid mx-auto max-w-5xl">
          <ol className="tour-copy">
            {screens.map((screen, index) => (
              <li
                key={screen.title}
                ref={(node) => {
                  blocks.current[index] = node;
                }}
                className="tour-step"
              >
                <div className="tour-block">
                  <h2 className="font-serif text-2xl leading-tight font-medium text-balance sm:text-3xl">
                    {screen.title}
                  </h2>
                  <p className="text-muted mt-4 leading-relaxed text-pretty">{screen.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="tour-rail">
            {/* Every capture is in the stack and only the ones being read are
                painted, so the swap is a dissolve rather than a load, and the
                box keeps the captures' shape whichever one is showing. */}
            <div className="tour-shots">
              {screens.map((screen, index) => (
                <div
                  key={screen.title}
                  ref={(node) => {
                    layers.current[index] = node;
                  }}
                  className="screen-layer"
                >
                  <Capture screen={screen} />
                </div>
              ))}
            </div>

            <div aria-hidden className="tour-dots">
              {screens.map((screen, index) => (
                <span
                  key={screen.title}
                  ref={(node) => {
                    dots.current[index] = node;
                  }}
                  className="progress-dot"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
