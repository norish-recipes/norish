/**
 * A recipe's worked-out nutrition for one household (ADR-0039), on the
 * server: its lines' Ingredient Nutrition as that household reads it,
 * through the shared arithmetic. The recipe page works the same total out
 * in the browser from the same module's answers; this is the language
 * model's estimate asking which lines are counted already. A recipe that
 * supplies Nutrition Information of its own has none worked out.
 */
import type { RecipeForNutrition, WorkedOutNutrition } from "@norish/shared/lib/recipe-nutrition";
import { getIngredientWords, getUnits } from "@norish/shared-server/config/server-config-loader";
import {
  nutritionLinesOf,
  seasoningPhrases,
  suppliesNutrition,
  workOutNutrition,
} from "@norish/shared/lib/recipe-nutrition";
import { spellingRules } from "@norish/shared/lib/spelling-keys";

import type { NutritionReader } from "./ingredient-nutrition";
import { resolveIngredientNutrition } from "./ingredient-nutrition";

/** The recipe's worked-out nutrition for the reader's household, or null where it supplies its own. */
export async function workOutRecipeNutrition(
  recipe: RecipeForNutrition,
  reader: NutritionReader
): Promise<WorkedOutNutrition | null> {
  if (suppliesNutrition(recipe)) return null;

  const lines = nutritionLinesOf(recipe);
  const nutrition = await resolveIngredientNutrition(
    lines.flatMap((line) => (line.ingredientId ? [line.ingredientId] : [])),
    reader
  );

  const units = await getUnits();

  return workOutNutrition({
    lines,
    servings: recipe.servings,
    nutrition,
    seasoning: seasoningPhrases(units),
    rules: spellingRules(units, await getIngredientWords()),
  });
}
