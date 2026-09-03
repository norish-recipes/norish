"use client";

import type { ComponentType, CSSProperties } from "react";
import { useRef } from "react";

import { CookScene, ImportScene, PlanScene } from "../doodles";
import { Mark } from "../marks";
import { clamp, useScrollFrame } from "../scroll-frame";
import { holdOf, prefersCalm, reachOf, stopsOf, walkAt } from "../sequence";
import { SnapPoints } from "../snapping";

/** Tint classes are written out in full so Tailwind's scanner can see them. */
const moments: {
  title: string;
  scene: ComponentType<{ className?: string }>;
  tint: string;
  track: string;
  fill: string;
  body: string;
}[] = [
  {
    title: "Import",
    scene: ImportScene,
    tint: "text-tint-site",
    track: "bg-tint-site/20",
    fill: "bg-tint-site",
    body: "A link, a video, a photo or plain text. Norish parses it into a clean readable recipe.",
  },
  {
    title: "Plan",
    scene: PlanScene,
    tint: "text-tint-text",
    track: "bg-tint-text/20",
    fill: "bg-tint-text",
    body: "Drop meals onto a calendar shared by your household.",
  },
  {
    title: "Cook",
    scene: CookScene,
    tint: "text-tint-photo",
    track: "bg-tint-photo/25",
    fill: "bg-tint-photo",
    body: "Use the cooking mode, to remove the clutter and focus on the task at hand.",
  },
];

/** The share of the held screen spent moving from one step to the next. */
const GLIDE = 0.18;

/** Where the scroll may stop, and how near it has to be to be carried there. */
const STOPS = stopsOf(moments.length, GLIDE);
const REACH = reachOf(moments.length, GLIDE);

/**
 * Import, then plan, then cook: a sequence, so it plays like one. The section
 * holds the screen and the page's own scroll walks the rail sideways, a step at
 * a time, resting on each one long enough to read it with the next already
 * ghosting in past the edge. Everything is worked out from where the section
 * sits in the scroll, so it scrubs both ways and never plays to an empty room;
 * under reduced motion the rail snaps between steps instead of sliding.
 *
 * How fast that reads is not decided here. The page's scroll is Lenis's (see
 * `app/providers.tsx`), which is what keeps a flick from carrying the whole
 * sequence past in two frames, and the rests below are where it may stop.
 *
 * Without scripting the rail is exactly what it looks like: a row you swipe
 * yourself, snapping to each step (see `.moments-*` in globals.css).
 */
export function Moments() {
  const stage = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const steps = useRef<(HTMLLIElement | null)[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  useScrollFrame(() => {
    const section = stage.current;

    if (!section || !rail.current) return;

    const { top, height } = section.getBoundingClientRect();
    const held = height - window.innerHeight;
    const progress = held > 0 ? clamp(-top / held) : 0;
    const walked = walkAt(progress, moments.length, GLIDE);
    const walk = prefersCalm() ? Math.round(walked) : walked;
    const hold = holdOf(moments.length, GLIDE);
    // How much of the section has arrived, for the first step: it is already
    // there when the screen is taken, so it settles on the way in instead.
    const arriving = clamp((window.innerHeight - top) / window.innerHeight);

    rail.current.style.setProperty("--walk", `${walk}`);
    // The pin is held still against the page, so what the drawings in its
    // margins travel against is the section's own progress instead.
    pin.current?.style.setProperty("--drift", `${progress * 2 - 1}`);

    steps.current.forEach((step, index) => {
      if (!step) return;

      const resting = clamp((progress - index * (hold + GLIDE)) / hold);
      const settled = index === 0 ? Math.max(resting, arriving) : resting;
      // The drawing starts while the step is still sliding in rather than once
      // it has landed, so a scene is never sitting on the screen, fully
      // readable beside its words, as a set of marks that have not joined up.
      const drawing = clamp(
        (progress - index * (hold + GLIDE) + GLIDE * 0.8) / (GLIDE * 0.8 + hold * 0.5)
      );

      step.style.setProperty("--draw", `${index === 0 ? Math.max(drawing, arriving) : drawing}`);
      step.style.setProperty("--fill", `${clamp((settled - 0.15) / 0.6)}`);
      // What happens in a drawing after it has been drawn — the sources going
      // into the bowl — runs off the step's own turn on the screen, not off
      // `settled`: the first step is handed that already finished so that it
      // opens fully drawn, and anything scrubbed from it would then have played
      // to nobody on the way in. The steam is not scrubbed at all; it rises on
      // its own clock (see `.steam-line` in globals.css).
      step.style.setProperty("--settle", `${resting}`);
    });

    dots.current.forEach((dot, index) => {
      dot?.style.setProperty("--lit", `${clamp(1 - Math.abs(walk - index))}`);
    });
  });

  return (
    <section
      ref={stage}
      className="moments-stage border-border border-t"
      style={{ "--steps": `${moments.length}` } as CSSProperties}
    >
      <SnapPoints at={STOPS} reach={REACH} />

      <div ref={pin} className="moments-pin py-20 sm:py-24">
        {/* Off the worktop, in the room the steps leave either side of them. */}
        <Mark at="top-[11%] left-[4%] size-10 sm:size-11" depth={1.3} shape="sprig" turn={13} />
        <Mark
          at="top-[20%] right-[6%] hidden size-11 lg:block"
          delay={140}
          depth={-0.9}
          shape="pear"
          turn={16}
        />
        <Mark
          at="bottom-[14%] left-[8%] hidden size-10 sm:block"
          delay={80}
          depth={-1.1}
          shape="tomato"
          turn={18}
        />
        <Mark
          at="right-[10%] bottom-[10%] size-10"
          delay={220}
          depth={1.6}
          shape="lemon"
          turn={14}
        />

        <div className="moments-viewport">
          <ol ref={rail} className="moments-track">
            {moments.map(({ title, body, scene: Scene, tint, track, fill }, index) => (
              <li
                key={title}
                ref={(node) => {
                  steps.current[index] = node;
                }}
                className="moment"
              >
                {/* The drawing sits beside the words where a step is wide enough
                    to hold both, and above them where it is not. */}
                <div className="moment-body">
                  <Scene className={`moment-scene ${tint}`} />

                  <div className="moment-words max-w-2xl">
                    <div className="flex items-center gap-4">
                      <span className={`font-serif text-lg leading-none font-medium ${tint}`}>
                        {`0${index + 1}`}
                      </span>
                      <span
                        className={`relative block h-0.5 flex-1 overflow-hidden rounded-full ${track}`}
                      >
                        <span
                          aria-hidden
                          className={`moment-fill absolute inset-0 origin-left ${fill}`}
                        />
                      </span>
                    </div>

                    <h2 className="mt-8 font-serif text-4xl leading-tight font-medium text-balance sm:text-5xl">
                      {title}
                    </h2>
                    <p className="text-muted mt-5 max-w-xl leading-relaxed text-pretty sm:text-lg">
                      {body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Which step you are on. Only shown where the rail moves with the
            page; where you swipe it yourself, the rail says so itself. */}
        <div aria-hidden className="moments-dots mx-auto mt-12 w-full max-w-5xl px-5 sm:px-8">
          {moments.map(({ title }, index) => (
            <span
              key={title}
              ref={(node) => {
                dots.current[index] = node;
              }}
              className="progress-dot"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
