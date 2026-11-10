"use client";

import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";

import { useLoadedPageRecipe, usePageIngredients } from "@norish/shared-react/recipes";

export default function IngredientsList() {
  const recipe = useLoadedPageRecipe();
  const display = usePageIngredients();

  return (
    <ReadonlyIngredientsList interactive ingredients={display} systemUsed={recipe.systemUsed} />
  );
}
