"use client";

import { PublicSmartInstruction, ReadonlyStepsList } from "@/features/recipes/components/read-only";
import {
  useSharedRecipe,
  useShareIngredients,
  useSharePageStore,
  useShareSystem,
  useShareUnits,
} from "@/features/recipes/stores/share-page-store";

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
