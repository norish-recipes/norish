"use client";

import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

import { useRecipeContext } from "../context";

export default function StepsList() {
  const context = useRecipeContext();
  const recipe = context?.recipe;
  const ingredients =
    context?.adjustedIngredients && context.adjustedIngredients.length > 0
      ? context.adjustedIngredients
      : (recipe?.recipeIngredients ?? []);

  return (
    <ReadonlyStepsList
      enableTimers
      interactive
      ingredients={ingredients}
      recipeId={recipe?.id}
      recipeName={recipe?.name}
      steps={recipe?.steps ?? []}
      systemUsed={recipe?.systemUsed ?? "metric"}
    />
  );
}
