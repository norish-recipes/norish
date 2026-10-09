"use client";

import { useState } from "react";
import { CookbookIconOutline } from "@/components/cookbooks/cookbook-icon";

/**
 * The cover: the cookbook's uploaded image when it has one, otherwise a
 * mosaic of the first few members' primary images.
 *
 * The mosaic stores nothing — the tiles come from the members themselves, so
 * it can never go stale. An uploaded image that fails to load falls back to
 * it rather than to an empty tile. Fewer members than tiles
 * fills what exists; none falls back to exactly the treatment a recipe with
 * no picture gets, with the cookbook's own mark in place of the photo one, so
 * an empty cookbook reads as the same kind of "nothing here yet" rather than
 * as a different component.
 */
export default function CookbookCover({
  image,
  images,
  title,
  className = "",
  emptyIconClassName = "h-12 w-12",
}: {
  image?: string | null;
  images: readonly string[];
  title: string;
  className?: string;
  emptyIconClassName?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const tiles = image && !failed.includes(image) ? [image] : images;
  const usable = tiles.filter((tile) => !failed.includes(tile)).slice(0, 4);

  if (usable.length === 0) {
    return (
      <div
        className={`bg-surface-secondary text-muted flex h-full w-full items-center justify-center ${className}`}
      >
        <CookbookIconOutline aria-hidden className={`${emptyIconClassName} opacity-70`} />
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
      {usable.map((tile, index) => (
        <img
          key={tile}
          alt=""
          className={`h-full w-full object-cover ${usable.length === 3 && index === 0 ? "row-span-2" : ""}`}
          loading="lazy"
          src={tile}
          title={title}
          onError={() => setFailed((previous) => [...previous, tile])}
        />
      ))}
    </div>
  );
}
