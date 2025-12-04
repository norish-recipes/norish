"use client";

import { useEffect, useState } from "react";

import { useRecipeContextRequired } from "../context";

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

  useEffect(() => {
    if (adjustedIngredients?.length > 0) setDisplay(adjustedIngredients);
    else setDisplay(recipe.recipeIngredients);
  }, [adjustedIngredients, recipe.recipeIngredients]);

  return (
    <ul className="mt-2 list-disc space-y-4 text-sm leading-relaxed">
      {display
        .filter((it) => it.systemUsed === recipe.systemUsed)
        .sort((a, b) => a.order - b.order)
        .map((it, idx) => {
          const amount = formatAmount(it.amount);
          const unit = it.unit || "";

          return (
            <li key={`${it.ingredientName}-${idx}`} className="flex flex-wrap items-baseline gap-1">
              {amount !== "" && <span>{amount}</span>}
              {unit && <span className="text-primary-500 font-medium">{unit}</span>}
              <span className="text-default-700">{it.ingredientName}</span>
            </li>
          );
        })}
    </ul>
  );
}
