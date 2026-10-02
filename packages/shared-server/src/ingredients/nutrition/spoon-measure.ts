/**
 * The measure an Ingredient's spoon weight is shown and corrected in, for
 * one viewer (ADR-0039, spoon measures): the volume measure the recipes they
 * can open use most for it, or none where no recipe measures it by volume,
 * so onion's panel has no spoon row until a recipe says "1 cup chopped
 * onion".
 */
import type { RecipeListContext } from "@norish/db/repositories/recipes";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import { countIngredientLinesByUnit } from "@norish/db/repositories/ingredient-nutrition";
import { mostUsedSpoonMeasure } from "@norish/shared/lib/spoon-measure";

export async function spoonMeasureFor(
  viewer: RecipeListContext,
  ingredientId: string
): Promise<SpoonMeasure | null> {
  return mostUsedSpoonMeasure(await countIngredientLinesByUnit(viewer, ingredientId));
}
