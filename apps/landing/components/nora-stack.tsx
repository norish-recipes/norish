"use client";

import { useState } from "react";

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
  "z-2 -translate-x-14 translate-y-2.5 -rotate-6",
  "z-1 -translate-x-26 translate-y-6.5 -rotate-14",
];

/** Polaroids of Nora in a pile; pressing the pile sends the front one to the back. */
export function NoraStack() {
  const [front, setFront] = useState(0);
  const next = () => setFront((front + 1) % photos.length);

  return (
    <button
      aria-label="Show another photo of Nora"
      className="relative block min-h-[34rem] min-w-0 flex-1 basis-[26rem] cursor-pointer rounded-lg sm:min-h-[40rem]"
      type="button"
      onClick={next}
    >
      {photos.map((photo, index) => (
        <figure
          key={photo.base}
          aria-hidden={index !== front}
          className={`polaroid ${pile[(index - front + photos.length) % photos.length]}`}
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
