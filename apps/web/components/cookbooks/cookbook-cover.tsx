"use client";

import { useState } from "react";
import { CookbookIconOutline } from "@/components/cookbooks/cookbook-icon";

import { coverMosaicColumns } from "@norish/shared-react/recipes";
import { addBasePath } from "@norish/shared/lib/base-path";

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

  return (
    <div className={`flex h-full w-full gap-0.5 ${className}`}>
      {coverMosaicColumns(usable.length).map((rows) => (
        <div key={rows.join()} className="flex min-w-0 flex-1 flex-col gap-0.5">
          {rows.map((index) => {
            const tile = usable[index] ?? "";

            return (
              <img
                key={tile}
                alt=""
                className="min-h-0 w-full flex-1 object-cover"
                loading="lazy"
                src={addBasePath(tile)}
                title={title}
                onError={() => setFailed((previous) => [...previous, tile])}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
