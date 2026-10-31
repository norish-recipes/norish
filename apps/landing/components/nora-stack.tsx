"use client";

import { useEffect, useRef, useState } from "react";

import type { ShotName } from "./shot";
import { Shot } from "./shot";

const photos: { base: ShotName; alt: string; caption: string }[] = [
  {
    base: "nora-bench",
    alt: "Nora, an Australian Shepherd, leaning into the camera on a yellow and blue mosaic bench",
    caption: "Nora invites you to use Norish",
  },
  {
    base: "nora-snow",
    alt: "Nora in profile, sitting in the snow",
    caption: "Snow day means soup day",
  },
  {
    base: "nora-sunset",
    alt: "Nora lying on a wall in the evening sun",
    caption: "Waiting for dinner since five",
  },
];

/** Where each place in the pile sits, front first. */
const pile = [
  "z-3 rotate-4",
  "z-2 -translate-x-[15%] translate-y-2.5 -rotate-6",
  "z-1 -translate-x-[27%] translate-y-6.5 -rotate-14",
];

/** How long each photo stays on top before the next one comes up, in ms. */
const TURN_EVERY = 5000;

/**
 * Polaroids of Nora in a pile. Every few seconds, or on a press, the front one
 * swings out and tucks in at the back; the pile holds still under the pointer.
 */
export function NoraStack() {
  const [turns, setTurns] = useState(0);
  const pileRef = useRef<HTMLButtonElement>(null);
  const front = turns % photos.length;
  const back = (front + photos.length - 1) % photos.length;

  // Depends on turns so a press restarts the wait.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      if (!pileRef.current?.matches(":hover")) setTurns((count) => count + 1);
    }, TURN_EVERY);

    return () => clearInterval(timer);
  }, [turns]);

  return (
    <button
      ref={pileRef}
      aria-label="Show another photo of Nora"
      className="reveal reveal-right relative block aspect-[5/6] min-w-0 cursor-pointer rounded-lg max-sm:order-last sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center"
      type="button"
      onClick={() => setTurns(turns + 1)}
    >
      {photos.map((photo, index) => (
        <figure
          key={photo.base}
          aria-hidden={index !== front}
          className={`polaroid ${pile[(index - front + photos.length) % photos.length]}`}
          data-tucking={turns > 0 && index === back ? true : undefined}
        >
          <Shot
            alt={photo.alt}
            base={photo.base}
            className="block aspect-[3/4] w-full rounded-xs object-cover"
            sizes="24rem"
          />
          <figcaption className="text-center text-[1.0625rem] font-medium">
            {photo.caption}
          </figcaption>
        </figure>
      ))}
    </button>
  );
}
