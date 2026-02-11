"use client";

import { Image } from "@heroui/react";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

type Size = "sm" | "md";

const sizeClasses: Record<Size, string> = {
  sm: "h-12 w-12",
  md: "h-14 w-14",
};

type PlannedItemThumbnailProps = {
  /** "recipe" or "note" */
  itemType: "recipe" | "note";
  /** Image URL – only relevant for recipes */
  image?: string | null;
  /** Alt text for the image */
  alt?: string;
  /** Size variant */
  size?: Size;
};

/**
 * Thumbnail for a planned calendar item.
 *
 * - Recipe with image  => shows the image
 * - Recipe without image => placeholder with "Recipe" text
 * - Note                => placeholder with "Note" text
 */
export const PlannedItemThumbnail = memo(function PlannedItemThumbnail({
  itemType,
  image,
  alt = "",
  size = "sm",
}: PlannedItemThumbnailProps) {
  const t = useTranslations("calendar.timeline");
  const dim = sizeClasses[size];
  const isRecipe = itemType === "recipe";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = isRecipe && image && image !== failedSrc ? image : null;

  if (imageSrc) {
    return (
      <div className={`relative ${dim} shrink-0 overflow-hidden rounded-lg`}>
        <Image
          removeWrapper
          alt={alt}
          className="h-full w-full object-cover"
          src={imageSrc}
          onError={() => setFailedSrc(imageSrc)}
        />
      </div>
    );
  }

  return (
    <div
      className={`bg-default-100 text-default-400 flex ${dim} shrink-0 items-center justify-center rounded-lg`}
    >
      <span className="text-xs font-medium">{isRecipe ? t("recipe") : t("note")}</span>
    </div>
  );
});
