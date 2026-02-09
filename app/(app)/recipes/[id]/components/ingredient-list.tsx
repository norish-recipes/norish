"use client";

import { useState } from "react";
import { CheckIcon } from "@heroicons/react/20/solid";

import { useRecipeContextRequired } from "../context";

import { formatAmount } from "@/lib/format-amount";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";

export default function IngredientsList() {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const { mode } = useAmountDisplayPreference();
  const { formatAmountUnit } = useUnitFormatter();

  // Use adjustedIngredients directly, fall back to recipe ingredients only if empty
  const display = adjustedIngredients?.length > 0 ? adjustedIngredients : recipe.recipeIngredients;

  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);

      if (next.has(idx)) next.delete(idx);
      else next.add(idx);

      return next;
    });
  };

  const onKeyToggle = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(idx);
    }
  };

  return (
    <ul className="space-y-2">
      {display
        .filter((it) => it.systemUsed === recipe.systemUsed)
        .sort((a, b) => a.order - b.order)
        .map((it, idx) => {
          const isHeading = it.ingredientName.trim().startsWith("#");

          if (isHeading) {
            const headingText = it.ingredientName.trim().replace(/^#+\s*/, "");

            return (
              <li key={`heading-${idx}`} className="list-none">
                <div className="px-3 py-2">
                  <h3 className="text-foreground text-base font-semibold">{headingText}</h3>
                </div>
              </li>
            );
          }

          const amount = formatAmount(it.amount, mode);
          // Format unit with locale-aware display
          const unit = it.unit ? formatAmountUnit(null, it.unit) : "";
          const isChecked = checked.has(idx);

          return (
            <li key={`${it.ingredientName}-${idx}`}>
              <div
                aria-pressed={isChecked}
                className={`group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 select-none ${
                  isChecked
                    ? "bg-default-100/50 dark:bg-default-100/5"
                    : "hover:bg-default-100 dark:hover:bg-default-100/10"
                }`}
                role="button"
                tabIndex={0}
                onClick={() => toggle(idx)}
                onKeyDown={(e) => onKeyToggle(e, idx)}
              >
                {/* Checkbox */}
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                    isChecked
                      ? "border-success bg-success"
                      : "border-default-300 group-hover:border-primary-400 dark:border-default-600"
                  }`}
                >
                  {isChecked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                </div>

                {/* Ingredient content */}
                <div
                  className={`flex flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 transition-opacity duration-200 ${
                    isChecked ? "opacity-50" : ""
                  }`}
                >
                  {amount !== "" && (
                    <span
                      className={`text-base font-bold tabular-nums ${isChecked ? "text-default-500 line-through" : "text-foreground"}`}
                    >
                      {amount}
                    </span>
                  )}
                  {unit && (
                    <span
                      className={`text-base font-bold ${isChecked ? "text-default-400 line-through" : "text-primary-600 dark:text-primary-400"}`}
                    >
                      {unit}
                    </span>
                  )}
                  <span
                    className={`text-base ${isChecked ? "text-default-400 line-through" : "text-base"}`}
                  >
                    <SmartMarkdownRenderer disableLinks={isChecked} text={it.ingredientName} />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
    </ul>
  );
}
