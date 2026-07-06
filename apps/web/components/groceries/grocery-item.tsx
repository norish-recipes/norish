"use client";

import { memo } from "react";
import { RecurrencePill } from "@/app/(app)/groceries/components/recurrence-pill";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";

import { GroceryCheckbox } from "./grocery-checkbox";

interface GroceryItemProps {
  grocery: GroceryDto;
  store?: StoreDto | null;
  recurringGrocery?: RecurringGroceryDto | null;
  recipeName?: string | null;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function GroceryItemComponent({
  grocery,
  recurringGrocery,
  recipeName,
  onToggle,
  onEdit,
  isFirst = false,
  isLast = false,
}: GroceryItemProps) {
  const roundedClass =
    isFirst && isLast ? "rounded-lg" : isFirst ? "rounded-t-lg" : isLast ? "rounded-b-lg" : "";
  const t = useTranslations("groceries.item");
  const { formatAmountUnit } = useUnitFormatter();
  const hasSubtitle = Boolean(recurringGrocery || recipeName);

  const amountDisplay = formatAmountUnit(grocery.amount, grocery.unit);

  return (
    <div
      className={`bg-surface flex items-center gap-3 px-4 py-3 pl-10 ${roundedClass} ${hasSubtitle ? "min-h-[72px]" : "min-h-14"}`}
    >
      <GroceryCheckbox
        aria-label={grocery.name || t("unnamedItem")}
        delayChangeOnSelect
        isSelected={grocery.isDone}
        size="lg"
        onChange={(checked) => onToggle(grocery.id, checked)}
      />

      {/* Clickable content area */}
      <button
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
        type="button"
        onClick={() => onEdit(grocery)}
      >
        {/* Main row: amount/unit + name */}
        <div className="flex w-full items-baseline gap-1.5">
          {/* Highlighted amount/unit */}
          {amountDisplay && (
            <span
              className={`shrink-0 font-medium ${grocery.isDone ? "text-muted" : "text-accent"}`}
            >
              {amountDisplay}
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

        {/* Recipe name indicator */}
        {recipeName && !recurringGrocery && (
          <span className="text-muted mt-0.5 truncate text-xs">{recipeName}</span>
        )}

        {/* Recurring pill underneath */}
        {recurringGrocery && (
          <RecurrencePill className="mt-0.5" recurringGrocery={recurringGrocery} />
        )}
      </button>
    </div>
  );
}

export const GroceryItem = memo(GroceryItemComponent);
