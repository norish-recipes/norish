"use client";

import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";

import { useShareIngredients, useShareSystem, useShareUnits } from "../public/share-page-store";

export function ShareRecipeIngredients() {
  const ingredients = useShareIngredients();
  const system = useShareSystem();
  const units = useShareUnits();

  return (
    <ReadonlyIngredientsList
      interactive
      ingredients={ingredients}
      systemUsed={system}
      units={units}
    />
  );
}
