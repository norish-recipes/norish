import type { StepIngredientLink } from "@norish/db/repositories/steps";
import { attachStepIngredient } from "@norish/db/repositories/steps";

import type { AIE2EStack } from "./fixture";
import { readRecipe, recipeIdNamed } from "../harness/recipes";

/** Every Step Ingredient of the recipe of that name, as the recipe page reads them, in order. */
export async function readStoredStepIngredients(
  stack: AIE2EStack,
  recipeName: string
): Promise<StepIngredientLink[]> {
  const recipe = await readRecipe(
    stack.baseURL,
    stack.ownerCookies,
    await recipeIdNamed(recipeName)
  );

  return (recipe?.steps ?? [])
    .flatMap((step) =>
      step.stepIngredients.map((link) => ({
        systemUsed: step.systemUsed,
        stepOrder: Number(step.order),
        ingredientOrder: link.ingredientOrder,
        share: link.share,
        linkOrder: link.order,
      }))
    )
    .sort(
      (a, b) =>
        a.systemUsed.localeCompare(b.systemUsed) ||
        a.stepOrder - b.stepOrder ||
        a.linkOrder - b.linkOrder
    )
    .map(({ linkOrder: _linkOrder, ...row }) => row);
}

/** One link added beside what the recipe has, in one system: a repository write, as no form adds one alone. */
export async function supplyStepIngredient(
  recipeName: string,
  link: StepIngredientLink
): Promise<void> {
  if (!(await attachStepIngredient(await recipeIdNamed(recipeName), link))) {
    throw new Error(`Could not attach Step Ingredient on: ${recipeName}`);
  }
}
