"use client";

import type { PlannedItemDisplay } from "./types";

import { useTranslations } from "next-intl";
import { memo, useMemo } from "react";

import { buildItemSubtitle } from "./types";

import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";

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

  const title = item.itemType === "recipe" ? item.recipeName : item.title;

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
      <PlannedItemThumbnail alt={title ?? ""} image={item.recipeImage} itemType={item.itemType} />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground truncate text-sm font-medium" title={title ?? ""}>
          {title || t("untitled")}
        </span>

        {subtitle && <span className="text-default-400 truncate text-xs">{subtitle}</span>}
      </div>
    </div>
  );
});
