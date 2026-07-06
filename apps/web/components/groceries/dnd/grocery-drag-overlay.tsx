"use client";

import { RecurrencePill } from "@/app/(app)/groceries/components/recurrence-pill";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { Bars3Icon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import { GroceryCheckbox } from "../grocery-checkbox";

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
    "bg-surface ring-accent/20 flex items-center gap-3 rounded-lg px-4 py-3 shadow-xl ring-2";
  const iconWrapClass = "text-muted flex h-8 w-8 items-center justify-center";
  const contentClass = "flex min-w-0 flex-1 flex-col items-start gap-0.5";
  const rowClass = "flex w-full items-baseline gap-1.5";

  return (
    <div className={containerClass} style={{ minHeight: hasSubtitle ? 72 : 56 }}>
      <div className={iconWrapClass}>
        <Bars3Icon className="h-5 w-5" />
      </div>

      <GroceryCheckbox
        aria-label={grocery.name || t("unnamedItem")}
        isDisabled
        isSelected={grocery.isDone}
        size="lg"
      />

      <div className={contentClass}>
        <div className={rowClass}>
          {(grocery.amount || grocery.unit) && (
            <span
              className={`shrink-0 font-medium ${grocery.isDone ? "text-muted" : "text-accent"}`}
            >
              {formatAmountUnit(grocery.amount, grocery.unit)}
            </span>
          )}
          <span
            className={`truncate text-base ${
              grocery.isDone ? "text-muted line-through" : "text-foreground"
            }`}
          >
            {grocery.name || t("unnamedItem")}
          </span>
        </div>

        {recipeName && !recurringGrocery && (
          <span className="text-muted mt-0.5 truncate text-xs">{recipeName}</span>
        )}

        {recurringGrocery && (
          <RecurrencePill className="mt-0.5" recurringGrocery={recurringGrocery} />
        )}
      </div>
    </div>
  );
}
