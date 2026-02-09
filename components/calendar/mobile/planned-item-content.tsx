"use client";

import type { PlannedItemDisplay } from "./types";

import { Image } from "@heroui/react";
import { useTranslations } from "next-intl";
import { memo, useMemo } from "react";

import { buildItemSubtitle } from "./types";

type PlannedItemContentProps = {
  item: PlannedItemDisplay;
  /** Additional container classes */
  className?: string;
};

/**
 * Shared content layout for planned items - used by both
 * TimelinePlannedItem and TimelineDragOverlay
 */
export const PlannedItemContent = memo(function PlannedItemContent({
  item,
  className = "",
}: PlannedItemContentProps) {
  const t = useTranslations("calendar.timeline");

  const isRecipe = item.itemType === "recipe";
  const title = isRecipe ? item.recipeName : item.title;
  const hasImage = isRecipe && item.recipeImage;

  const subtitle = useMemo(
    () =>
      buildItemSubtitle(item, {
        serving: t("serving"),
        servings: t("servings"),
      }),
    [item, t]
  );

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {hasImage ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
          <Image
            removeWrapper
            alt={title ?? ""}
            className="h-full w-full object-cover"
            src={item.recipeImage!}
          />
        </div>
      ) : (
        <div className="bg-default-100 text-default-400 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
          <span className="text-xs font-medium">{isRecipe ? t("noImage") : t("note")}</span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground truncate text-sm font-medium" title={title ?? ""}>
          {title || t("untitled")}
        </span>
        {subtitle && <span className="text-default-400 truncate text-xs">{subtitle}</span>}
      </div>
    </div>
  );
});
