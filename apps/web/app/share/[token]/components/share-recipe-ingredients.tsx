"use client";

import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";

import { usePublicRecipeContext } from "../public/public-recipe-context";

export function ShareRecipeIngredients() {
  const { state, units } = usePublicRecipeContext();

  return (
    <ReadonlyIngredientsList
      interactive
      ingredients={state.adjustedIngredients}
      systemUsed={state.activeSystem}
      units={units}
    />
  );
}
