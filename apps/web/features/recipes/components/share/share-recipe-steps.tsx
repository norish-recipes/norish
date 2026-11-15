"use client";

import { PublicSmartInstruction } from "@/features/recipes/components/read-only/public-smart-instruction";
import { ReadonlyStepsList } from "@/features/recipes/components/read-only/readonly-steps-list";
import {
  useSharedRecipe,
  useShareIngredients,
  useSharePageStore,
  useShareSystem,
  useShareUnits,
} from "@/features/recipes/lib/share-page-store";

export function ShareRecipeSteps() {
  const recipe = useSharedRecipe();
  const token = useSharePageStore((state) => state.token);
  const ingredients = useShareIngredients();
  const system = useShareSystem();
  const units = useShareUnits();

  return (
    <ReadonlyStepsList
      enableTimers
      interactive
      InstructionComponent={PublicSmartInstruction}
      ingredients={ingredients}
      recipeId={token}
      recipeName={recipe.name}
      steps={recipe.steps}
      systemUsed={system}
      token={token}
      units={units}
    />
  );
}
