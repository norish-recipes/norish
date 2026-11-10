"use client";

import { ReadonlyIngredientsList } from "@/features/recipes/components/read-only";

import { useLoadedPageRecipe, usePageIngredients } from "@norish/shared-react/recipes";

export default function IngredientsList() {
  const recipe = useLoadedPageRecipe();
  const display = usePageIngredients();

  return (
    <ReadonlyIngredientsList interactive ingredients={display} systemUsed={recipe.systemUsed} />
  );
}
