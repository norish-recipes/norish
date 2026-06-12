import { useMemo, useState } from "react";

import type { MeasurementSystem } from "@norish/shared/contracts";

import type { ShareIngredient, ShareRecipeState } from "./types";

export function useShareRecipeState(recipe: {
  servings: number;
  systemUsed: MeasurementSystem;
  recipeIngredients: ShareIngredient[];
}): ShareRecipeState {
  const [servings, setServings] = useState(Math.max(0.125, recipe.servings));
  const [activeSystem, setActiveSystem] = useState<MeasurementSystem>(recipe.systemUsed);
  const availableSystems = useMemo(
    () =>
      Array.from(
        new Set(recipe.recipeIngredients.map((ingredient) => ingredient.systemUsed))
      ) as MeasurementSystem[],
    [recipe.recipeIngredients]
  );
  const ratio = servings / recipe.servings;
  const adjustedIngredients = useMemo(
    () =>
      recipe.recipeIngredients.map((ingredient) => ({
        ...ingredient,
        amount: ingredient.amount != null ? ingredient.amount * ratio : null,
      })),
    [recipe.recipeIngredients, ratio]
  );

  return {
    servings,
    setServings,
    activeSystem,
    setActiveSystem,
    availableSystems,
    adjustedIngredients,
  };
}
