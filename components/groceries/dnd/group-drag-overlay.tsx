"use client";

import type { GroceryGroup } from "@/lib/grocery-grouping";

import { Checkbox } from "@heroui/react";
import { Bars3Icon, Square2StackIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useUnitFormatter } from "@/hooks/use-unit-formatter";

interface GroupDragOverlayProps {
  group: GroceryGroup;
}

/** Renders the grouped grocery item following the cursor during drag. */
export function GroupDragOverlay({ group }: GroupDragOverlayProps) {
  const t = useTranslations("groceries.item");
  const { formatAmountUnit } = useUnitFormatter();
  const hasMultipleSources = group.sources.length > 1;
  const aggregatedDisplay = formatAmountUnit(group.totalAmount, group.displayUnit);
  const containerClass =
    "bg-content1 ring-primary/20 flex items-center gap-3 rounded-lg px-4 py-3 shadow-xl ring-2";
  const iconWrapClass = "text-default-400 flex h-8 w-8 items-center justify-center";
  const contentClass = "flex min-w-0 flex-1 flex-col items-start gap-0.5";
  const rowClass = "flex w-full items-baseline gap-1.5";

  return (
    <div className={containerClass} style={{ minHeight: hasMultipleSources ? 72 : 56 }}>
      <div className={iconWrapClass}>
        <Bars3Icon className="h-5 w-5" />
      </div>

      <Checkbox
        isDisabled
        isIndeterminate={group.anyDone && !group.allDone}
        isSelected={group.allDone}
        radius="full"
        size="lg"
      />

      <div className={contentClass}>
        <div className={rowClass}>
          {aggregatedDisplay && (
            <span
              className={`shrink-0 font-medium ${
                group.allDone ? "text-default-400" : "text-primary"
              }`}
            >
              {aggregatedDisplay}
            </span>
          )}
          <span
            className={`truncate text-base ${
              group.allDone ? "text-default-400 line-through" : "text-foreground"
            }`}
          >
            {group.displayName || t("unnamedItem")}
          </span>
        </div>

        {hasMultipleSources && (
          <div className="text-default-400 mt-0.5 flex items-center gap-1 text-xs">
            <Square2StackIcon className="h-3.5 w-3.5" />
            <span>{t("items", { count: group.sources.length })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
