"use client";

import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

import type { IngredientLinkCandidate } from "@norish/shared-react/text";

import { useRecipeContext } from "../context";

type StepsListProps = {
  onIngredientPress?: (candidate: IngredientLinkCandidate) => void;
};

export default function StepsList({ onIngredientPress }: StepsListProps = {}) {
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
      onIngredientPress={onIngredientPress}
    />
  );
}
