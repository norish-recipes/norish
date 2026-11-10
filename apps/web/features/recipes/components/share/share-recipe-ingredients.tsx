"use client";

import { ReadonlyIngredientsList } from "@/features/recipes/components/read-only";
import {
  useShareIngredients,
  useShareSystem,
  useShareUnits,
} from "@/features/recipes/stores/share-page-store";

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
