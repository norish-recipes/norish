"use client";

import type { GroceryDto, RecurringGroceryDto } from "@/types";

import { Checkbox } from "@heroui/react";
import { Bars3Icon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { RecurrencePill } from "@/app/(app)/groceries/components/recurrence-pill";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";

interface GroceryDragOverlayProps {
  grocery: GroceryDto;
  recurringGrocery?: RecurringGroceryDto | null;
  recipeName?: string | null;
}

/** Renders the grocery item following the cursor during drag. */
export function GroceryDragOverlay({
  grocery,
  recurringGrocery,
  recipeName,
}: GroceryDragOverlayProps) {
  const t = useTranslations("groceries.item");
  const { formatAmountUnit } = useUnitFormatter();
  const hasSubtitle = Boolean(recurringGrocery || recipeName);
  const containerClass =
    "bg-content1 ring-primary/20 flex items-center gap-3 rounded-lg px-4 py-3 shadow-xl ring-2";
  const iconWrapClass = "text-default-400 flex h-8 w-8 items-center justify-center";
  const contentClass = "flex min-w-0 flex-1 flex-col items-start gap-0.5";
  const rowClass = "flex w-full items-baseline gap-1.5";

  return (
    <div className={containerClass} style={{ minHeight: hasSubtitle ? 72 : 56 }}>
      <div className={iconWrapClass}>
        <Bars3Icon className="h-5 w-5" />
      </div>

      <Checkbox isDisabled isSelected={grocery.isDone} radius="full" size="lg" />

      <div className={contentClass}>
        <div className={rowClass}>
          {(grocery.amount || grocery.unit) && (
            <span
              className={`shrink-0 font-medium ${
                grocery.isDone ? "text-default-400" : "text-primary"
              }`}
            >
              {formatAmountUnit(grocery.amount, grocery.unit)}
            </span>
          )}
          <span
            className={`truncate text-base ${
              grocery.isDone ? "text-default-400 line-through" : "text-foreground"
            }`}
          >
            {grocery.name || t("unnamedItem")}
          </span>
        </div>

        {recipeName && !recurringGrocery && (
          <span className="text-default-400 mt-0.5 truncate text-xs">{recipeName}</span>
        )}

        {recurringGrocery && (
          <RecurrencePill className="mt-0.5" recurringGrocery={recurringGrocery} />
        )}
      </div>
    </div>
  );
}
