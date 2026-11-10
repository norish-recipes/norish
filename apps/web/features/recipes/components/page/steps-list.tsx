"use client";

import { ReadonlyStepsList } from "@/features/recipes/components/read-only";

import { useLoadedPageRecipe, usePageIngredients } from "@norish/shared-react/recipes";

export default function StepsList() {
  const recipe = useLoadedPageRecipe();
  const ingredients = usePageIngredients();

  return (
    <ReadonlyStepsList
      enableTimers
      interactive
      ingredients={ingredients}
      recipeId={recipe.id}
      recipeName={recipe.name}
      steps={recipe.steps ?? []}
      systemUsed={recipe.systemUsed ?? "metric"}
    />
  );
}
