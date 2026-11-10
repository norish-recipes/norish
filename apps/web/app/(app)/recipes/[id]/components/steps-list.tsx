"use client";

import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

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
