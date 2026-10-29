import { listRecipeIdsWithoutDishColor } from "@norish/db/repositories/upgrades";
import { refreshDishColorForRecipe } from "@norish/shared-server/media/dish-color";

/** Recipes stored before 0.22 take the Dish Colour (ADR-0023) of the picture they lead with. */
export async function upgradeDishColours(): Promise<number> {
  const recipeIds = await listRecipeIdsWithoutDishColor();

  for (const recipeId of recipeIds) await refreshDishColorForRecipe(recipeId);

  return recipeIds.length;
}
