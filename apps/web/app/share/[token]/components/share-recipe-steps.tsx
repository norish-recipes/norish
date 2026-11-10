"use client";

import { PublicSmartInstruction } from "@/components/recipe/public-smart-instruction";
import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

import {
  useSharedRecipe,
  useShareIngredients,
  useSharePageStore,
  useShareSystem,
  useShareUnits,
} from "../public/share-page-store";

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
