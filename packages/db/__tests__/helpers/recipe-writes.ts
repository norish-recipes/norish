/**
 * The recipe writes as these suites call them: with the payload's line texts
 * resolved through the ingredient resolver first, as every production caller
 * does. The resolver lives above this package, so it is reached by path.
 */
import type { FullRecipeInsertDTO, FullRecipeUpdateDTO } from "@norish/shared/contracts";
import type { RecipeIngredientInsertDto } from "@norish/shared/contracts/dto/recipe-ingredient";
import type { StepInsertDto } from "@norish/shared/contracts/dto/steps";
import * as repository from "@norish/db/repositories/recipes";

import { withResolvedIngredients } from "../../../shared-server/src/ingredients/recipe-lines";

export async function createRecipeWithRefs(
  recipeId: string,
  userId: string | null | undefined,
  input: FullRecipeInsertDTO
) {
  return repository.createRecipeWithRefs(
    recipeId,
    userId,
    await withResolvedIngredients(input, { userId: userId ?? null })
  );
}

export async function updateRecipeWithRefs(
  recipeId: string,
  userId: string,
  input: FullRecipeUpdateDTO,
  version?: number
) {
  return repository.updateRecipeWithRefs(
    recipeId,
    userId,
    await withResolvedIngredients(input, { userId }),
    version
  );
}

export async function addStepsAndIngredientsToRecipeByInput(
  steps: StepInsertDto[],
  ingredients: RecipeIngredientInsertDto[]
) {
  const resolved = await withResolvedIngredients(
    { recipeIngredients: ingredients },
    { userId: null }
  );

  return repository.addStepsAndIngredientsToRecipeByInput(
    steps,
    resolved.recipeIngredients,
    resolved.ingredientResolutions
  );
}
