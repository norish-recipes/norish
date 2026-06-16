"use client";

import { PublicSmartInstruction } from "@/components/recipe/public-smart-instruction";
import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

import { usePublicRecipeContext } from "../public/public-recipe-context";

export function ShareRecipeSteps() {
  const { highlightIngredient, recipe, state, token } = usePublicRecipeContext();

  return (
    <ReadonlyStepsList
      enableTimers
      interactive
      InstructionComponent={PublicSmartInstruction}
      ingredients={state.adjustedIngredients}
      recipeId={token}
      recipeName={recipe.name}
      steps={recipe.steps}
      systemUsed={state.activeSystem}
      token={token}
      onIngredientPress={highlightIngredient}
    />
  );
}
