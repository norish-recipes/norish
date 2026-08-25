"use client";

import { useState } from "react";
import { BookmarkSquareIcon } from "@heroicons/react/24/outline";

/**
 * The derived cover: a mosaic of the first few members' primary images.
 *
 * Nothing is stored — the tiles come from the members themselves, so a cover
 * can never go stale and there is nothing to upload. Fewer members than tiles
 * fills what exists; none renders a plain tinted tile, which is a deliberate
 * new cookbook rather than a broken one.
 */
export default function CookbookCover({
  images,
  title,
  className = "",
  emptyIconClassName = "h-12 w-12",
}: {
  images: readonly string[];
  title: string;
  className?: string;
  emptyIconClassName?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const usable = images.filter((image) => !failed.includes(image)).slice(0, 4);

  if (usable.length === 0) {
    return (
      <div
        className={`bg-accent-soft0/25 text-accent flex h-full w-full items-center justify-center ${className}`}
      >
        <BookmarkSquareIcon aria-hidden className={`${emptyIconClassName} opacity-70`} />
      </div>
    );
  }

  // One tile fills; two split; three or four make a quarter grid with the
  // first image spanning the empty quarter, so a three-member cover still
  // reads as a deliberate arrangement.
  const layout =
    usable.length === 1
      ? "grid-cols-1 grid-rows-1"
      : usable.length === 2
        ? "grid-cols-2 grid-rows-1"
        : "grid-cols-2 grid-rows-2";

  return (
    <div className={`grid h-full w-full gap-0.5 ${layout} ${className}`}>
      {usable.map((image, index) => (
        <img
          key={image}
          alt=""
          className={`h-full w-full object-cover ${usable.length === 3 && index === 0 ? "row-span-2" : ""}`}
          loading="lazy"
          src={image}
          title={title}
          onError={() => setFailed((previous) => [...previous, image])}
        />
      ))}
    </div>
  );
}
