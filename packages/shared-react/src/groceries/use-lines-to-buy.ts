import type { FoodToBuy } from "@norish/shared/lib/line-foods";
import { foodsToBuy } from "@norish/shared/lib/line-foods";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

import type { EditedIngredient, GroceryIngredient } from "./recipe-lines";
import { useSpellingRules } from "../config";
import { usePlatform } from "../platform";
import { useLinkedRecipeIngredients, useRecipeIngredients, useServingsScaler } from "../recipes";
import { extractLinkedRecipeIds, isGroceryIngredient } from "./recipe-lines";
import { useGroceriesMutations } from "./use-groceries-mutations";
import { usePantryMutations } from "./use-pantry-mutations";
import { usePantryQuery } from "./use-pantry-query";

/**
 * A recipe's foods to buy at the servings picked, each line as edited here, split by whether the
 * Pantry holds it; and what puts lines on the list.
 */
export function useLinesToBuy(
  recipeId: string,
  originalServings: number,
  initialServings: number,
  editedIngredients: Record<string, EditedIngredient>
) {
  const { toast } = usePlatform();
  const { createGroceriesFromData } = useGroceriesMutations();
  const { addPantryIngredient } = usePantryMutations();
  const { ingredients: rawIngredients, systemUsed, isLoading } = useRecipeIngredients(recipeId);
  const { ingredients: linkedIngredients, isLoading: linkedLoading } = useLinkedRecipeIngredients(
    extractLinkedRecipeIds(rawIngredients as GroceryIngredient[]),
    systemUsed
  );
  // One row per food a line puts on the list: each of an "and" line's, an "or" line's first.
  const ingredients = foodsToBuy(
    [
      ...(rawIngredients as GroceryIngredient[]),
      ...(linkedIngredients as GroceryIngredient[]),
    ].filter(isGroceryIngredient)
  );
  const scaler = useServingsScaler(ingredients, originalServings, initialServings);
  // A line whose food the Pantry holds is shown apart and left off the list unless ticked; a line
  // edited here is only text, so it is matched by its name.
  const pantry = usePantryQuery();
  const rules = useSpellingRules();

  /** The Pantry Ingredient that covers a line, as edited here if it was. */
  const keptFor = (item: GroceryIngredient) => {
    const edited = editedIngredients[item.id]?.name;

    return pantryIngredientFor(
      pantry.items,
      edited === undefined ? item : { ingredientName: edited },
      rules
    );
  };
  const toBuy: typeof scaler.scaledIngredients = [];
  const inPantry: typeof scaler.scaledIngredients = [];

  for (const item of scaler.scaledIngredients) (keptFor(item) ? inPantry : toBuy).push(item);

  /**
   * "We keep this": the line's own food goes in the Pantry, or the food of the name as edited
   * here, resolved as a typed name is. The Pantry's optimistic row moves the line under "In your
   * pantry" at once.
   */
  const keepLine = (item: GroceryIngredient) => {
    const edited = editedIngredients[item.id]?.name;

    void addPantryIngredient(
      edited !== undefined || !item.ingredientId
        ? (edited ?? item.ingredientName)
        : { ingredientId: item.ingredientId, name: item.ingredientName }
    );
  };

  /** Puts these lines on the list, as edited here; true once they are on it. */
  const addLines = (lines: Array<FoodToBuy<GroceryIngredient>>) =>
    createGroceriesFromData(
      lines.map((ri) => ({
        name: editedIngredients[ri.id]?.name ?? ri.ingredientName,
        amount: editedIngredients[ri.id]?.amount ?? ri.amount,
        unit: editedIngredients[ri.id]?.unit ?? ri.unit ?? null,
        isDone: false,
        recipeIngredientId: ri.lineId,
      }))
    )
      .then(() => {
        toast.show({
          severity: "success",
          title: toast.translate("groceries.panel.ingredientsAdded"),
        });

        return true;
      })
      .catch(() => {
        toast.show({
          severity: "warning",
          title: toast.translate("groceries.panel.ingredientsFailed"),
        });

        return false;
      });

  return {
    ...scaler,
    isLoading,
    linkedLoading,
    pantry,
    keptFor,
    keepLine,
    toBuy,
    inPantry,
    addLines,
  };
}
