import type { GroceryIngredient } from "@norish/shared/lib/grocery-lines";
import { extractLinkedRecipeIds, isGroceryIngredient } from "@norish/shared/lib/grocery-lines";
import { foodsToBuy, linesAsRead } from "@norish/shared/lib/line-foods";

import { useLineReadings } from "./use-line-readings";
import { useLinkedRecipeIngredients } from "./use-linked-recipe-ingredients";
import { useRecipeIngredients } from "./use-recipe-ingredients";
import { useServingsScaler } from "./use-servings-scaler";

/** A recipe's and its linked recipes' foods to buy at the picked servings, one per food (each of an
 * "and" line's, an "or" line's first), read through the reader's catalogue; `isLoading` holds until
 * the linked recipes and the readings answer. */
export function useRecipeFoodsToBuy(
  recipeId: string,
  originalServings: number,
  initialServings: number
) {
  const { ingredients: rawIngredients, systemUsed, isLoading } = useRecipeIngredients(recipeId);
  const linkedIds = extractLinkedRecipeIds(rawIngredients as GroceryIngredient[]);
  const { ingredients: linkedIngredients, isLoading: linkedLoading } = useLinkedRecipeIngredients(
    linkedIds,
    systemUsed
  );
  const readings = useLineReadings([recipeId, ...linkedIds]);
  const foods = foodsToBuy(
    linesAsRead(
      [
        ...(rawIngredients as GroceryIngredient[]),
        ...(linkedIngredients as GroceryIngredient[]),
      ].filter(isGroceryIngredient),
      readings ?? {}
    )
  );

  return {
    ...useServingsScaler(foods, originalServings, initialServings),
    isLoading: isLoading || linkedLoading || !readings,
  };
}
