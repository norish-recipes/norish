"use client";

import { memo } from "react";
import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";
import { useTranslations } from "next-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

/** Calories and servings, for a recipe only. */
function buildItemSubtitle(
  item: PlannedItemFromQuery,
  translations: { serving: string; servings: string }
): string {
  const parts: string[] = [];

  if (item.itemType === "recipe") {
    if (item.calories && item.calories > 0) {
      parts.push(`${item.calories} kcal`);
    }
    if (item.servings && item.servings > 0) {
      parts.push(
        `${item.servings} ${item.servings === 1 ? translations.serving : translations.servings}`
      );
    }
  }

  return parts.join(" · ");
}

type PlannedItemContentProps = {
  item: PlannedItemFromQuery;
  /** Additional container classes */
  className?: string;
};

/** A planned item's thumbnail, title and subtitle, in its day and under the dragging pointer. */
export const PlannedItemContent = memo(function PlannedItemContent({
  item,
  className = "",
}: PlannedItemContentProps) {
  const t = useTranslations("calendar.timeline");

  const title = item.itemType === "recipe" ? item.recipeName : item.title;

  const subtitle = buildItemSubtitle(item, {
    serving: t("serving"),
    servings: t("servings"),
  });

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PlannedItemThumbnail alt={title ?? ""} image={item.recipeImage} itemType={item.itemType} />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground truncate text-sm font-medium" title={title ?? ""}>
          {title || t("untitled")}
        </span>

        {subtitle && <span className="text-muted truncate text-xs">{subtitle}</span>}
      </div>
    </div>
  );
});
