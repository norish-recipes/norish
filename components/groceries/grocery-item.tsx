"use client";

import type { GroceryDto, StoreDto, RecurringGroceryDto } from "@/types";

import { memo } from "react";
import { Checkbox } from "@heroui/react";
import { Bars2Icon } from "@heroicons/react/24/outline";

import { RecurrencePill } from "@/app/(app)/groceries/components/recurrence-pill";

interface GroceryItemProps {
  grocery: GroceryDto;
  store?: StoreDto | null;
  recurringGrocery?: RecurringGroceryDto | null;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function GroceryItemComponent({
  grocery,
  recurringGrocery,
  onToggle,
  onEdit,
  isFirst = false,
  isLast = false,
}: GroceryItemProps) {
  const roundedClass = isFirst && isLast ? 'rounded-lg' : isFirst ? 'rounded-t-lg' : isLast ? 'rounded-b-lg' : '';
  
  return (
    <div className={`bg-content1 flex items-center gap-3 px-4 py-3 ${roundedClass} ${recurringGrocery ? "min-h-[72px]" : "min-h-14"}`}>
      {/* Drag handle indicator */}
      <div className="text-default-300 -ml-1">
        <Bars2Icon className="h-5 w-5" />
      </div>

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
          {(grocery.amount || grocery.unit) && (
            <span
              className={`shrink-0 font-medium ${
                grocery.isDone ? "text-default-400" : "text-primary"
              }`}
            >
              {formatAmountUnit(grocery)}
            </span>
          )}
          <span
            className={`truncate text-base ${
              grocery.isDone ? "text-default-400 line-through" : "text-foreground"
            }`}
          >
            {grocery.name || "Unnamed item"}
          </span>
        </div>

        {/* Recurring pill underneath */}
        {recurringGrocery && (
          <RecurrencePill
            className="mt-0.5"
            recurringGrocery={recurringGrocery}
          />
        )}
      </button>
    </div>
  );
}

/**
 * Format amount and unit for highlighted display
 */
function formatAmountUnit(grocery: GroceryDto): string {
  const parts: string[] = [];

  if (grocery.amount && grocery.amount > 0) {
    // Format amount: show as integer if whole number, otherwise 1 decimal
    const formattedAmount =
      grocery.amount % 1 === 0 ? grocery.amount.toString() : grocery.amount.toFixed(1);
    parts.push(formattedAmount);
  }

  if (grocery.unit) {
    parts.push(grocery.unit);
  }

  return parts.join(" ");
}

export const GroceryItem = memo(GroceryItemComponent);
