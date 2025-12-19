"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "@heroicons/react/20/solid";

import { useRecipeContextRequired } from "../context";

import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { RecipeIngredientsDto } from "@/types/dto/recipe-ingredient";

// Format amount as a clean decimal (e.g., 2.5, 0.25)
function formatAmount(n: number | null | string): string {
  if (n == null || n === "") return "";

  const num = typeof n === "string" ? parseFloat(n) : n;

  if (isNaN(num)) return String(n);
  if (Number.isInteger(num)) return String(num);

  // Remove trailing zeros (e.g., 2.50 -> 2.5)
  return num.toFixed(2).replace(/\.?0+$/, "");
}

export default function IngredientsList() {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const [display, setDisplay] = useState<RecipeIngredientsDto[]>(recipe.recipeIngredients);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (adjustedIngredients?.length > 0) setDisplay(adjustedIngredients);
    else setDisplay(recipe.recipeIngredients);
  }, [adjustedIngredients, recipe.recipeIngredients]);

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

          const amount = formatAmount(it.amount);
          const unit = it.unit || "";
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
                      className={`text-base font-semibold tabular-nums ${isChecked ? "text-default-500 line-through" : "text-foreground"}`}
                    >
                      {amount}
                    </span>
                  )}
                  {unit && (
                    <span
                      className={`text-base font-medium ${isChecked ? "text-default-400 line-through" : "text-primary-600 dark:text-primary-400"}`}
                    >
                      {unit}
                    </span>
                  )}
                  <span
                    className={`text-base ${isChecked ? "text-default-400 line-through" : "text-default-700 dark:text-default-300"}`}
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
