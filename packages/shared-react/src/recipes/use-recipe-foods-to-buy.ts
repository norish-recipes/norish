import type { GroceryIngredient } from "@norish/shared/lib/grocery-lines";
import { extractLinkedRecipeIds, isGroceryIngredient } from "@norish/shared/lib/grocery-lines";
import { foodsToBuy } from "@norish/shared/lib/line-foods";

import { useLinkedRecipeIngredients } from "./use-linked-recipe-ingredients";
import { useRecipeIngredients } from "./use-recipe-ingredients";
import { useServingsScaler } from "./use-servings-scaler";

/**
 * A recipe's foods to buy at the servings picked: one row per food a line puts on the list (each
 * of an "and" line's, an "or" line's first), the recipes it links to included. `isLoading` holds
 * until the linked recipes have answered too, so no caller acts on a partial list.
 */
export function useRecipeFoodsToBuy(
  recipeId: string,
  originalServings: number,
  initialServings: number
) {
  const { ingredients: rawIngredients, systemUsed, isLoading } = useRecipeIngredients(recipeId);
  const { ingredients: linkedIngredients, isLoading: linkedLoading } = useLinkedRecipeIngredients(
    extractLinkedRecipeIds(rawIngredients as GroceryIngredient[]),
    systemUsed
  );
  const foods = foodsToBuy(
    [
      ...(rawIngredients as GroceryIngredient[]),
      ...(linkedIngredients as GroceryIngredient[]),
    ].filter(isGroceryIngredient)
  );

  return {
    ...useServingsScaler(foods, originalServings, initialServings),
    isLoading: isLoading || linkedLoading,
  };
}
