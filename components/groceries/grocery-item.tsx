"use client";

import type { GroceryDto, StoreDto, RecurringGroceryDto } from "@/types";

import { memo } from "react";
import { Checkbox } from "@heroui/react";
import { useTranslations } from "next-intl";

import { RecurrencePill } from "@/app/(app)/groceries/components/recurrence-pill";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";

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
      className={`bg-content1 flex items-center gap-3 px-4 py-3 pl-10 ${roundedClass} ${hasSubtitle ? "min-h-[72px]" : "min-h-14"}`}
    >
      <Checkbox
        isSelected={grocery.isDone}
        radius="full"
        size="lg"
        onValueChange={(checked) => onToggle(grocery.id, checked)}
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
              className={`shrink-0 font-medium ${
                grocery.isDone ? "text-default-400" : "text-primary"
              }`}
            >
              {amountDisplay}
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

        {/* Recipe name indicator */}
        {recipeName && !recurringGrocery && (
          <span className="text-default-400 mt-0.5 truncate text-xs">{recipeName}</span>
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
