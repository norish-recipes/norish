/**
 * The recipe writes as these suites call them: with the payload's line texts
 * resolved through the ingredient resolver first, as every production caller
 * does. The resolver lives above this package, so it is reached by path.
 */
import type { FullRecipeInsertDTO, FullRecipeUpdateDTO } from "@norish/shared/contracts";
import type { RecipeIngredientInsertDto } from "@norish/shared/contracts/dto/recipe-ingredient";
import type { StepInsertDto } from "@norish/shared/contracts/dto/steps";
import { getHouseholdIdForUser } from "@norish/db/repositories/households";
import { recipeHouseholdId } from "@norish/db/repositories/list-entries";
import * as repository from "@norish/db/repositories/recipes";

import { withResolvedIngredients } from "../../../shared-server/src/ingredients/recipe-lines";

/** The household lines resolve in: the recipe's, else its Owner's (ADR-0042). */
async function lineHousehold(userId: string | null | undefined, recipeId?: string) {
  const householdId =
    (recipeId ? await recipeHouseholdId(recipeId) : null) ??
    (userId ? await getHouseholdIdForUser(userId) : null);

  if (!householdId) throw new Error("A test recipe's lines have no household to resolve in");

  return householdId;
}

export async function createRecipeWithRefs(
  recipeId: string,
  userId: string | null | undefined,
  input: FullRecipeInsertDTO
) {
  return repository.createRecipeWithRefs(
    recipeId,
    userId,
    await withResolvedIngredients(input, {
      userId: userId ?? null,
      householdId: await lineHousehold(userId),
    })
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
    await withResolvedIngredients(input, {
      userId,
      householdId: await lineHousehold(userId, recipeId),
    }),
    version
  );
}

export async function addStepsAndIngredientsToRecipeByInput(
  steps: StepInsertDto[],
  ingredients: RecipeIngredientInsertDto[]
) {
  const resolved = await withResolvedIngredients(
    { recipeIngredients: ingredients },
    {
      userId: null,
      householdId: await lineHousehold(null, ingredients[0]?.recipeId ?? steps[0]?.recipeId),
    }
  );

  return repository.addStepsAndIngredientsToRecipeByInput(
    steps,
    resolved.recipeIngredients,
    resolved.ingredientResolutions
  );
}
