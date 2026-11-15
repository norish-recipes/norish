import { useRef, useState } from "react";

import type { EditedIngredient, GroceryIngredient } from "@norish/shared/lib/grocery-lines";
import type { FoodToBuy } from "@norish/shared/lib/line-foods";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

import { useSpellingRules } from "../config";
import { usePlatform } from "../platform";
import { useGroceriesMutations } from "./use-groceries-mutations";
import { usePantryMutations } from "./use-pantry-mutations";
import { usePantryQuery } from "./use-pantry-query";

/** A recipe's food to buy at the servings picked, its amount always a number. */
export type ScaledFood = Omit<FoodToBuy<GroceryIngredient>, "amount"> & { amount: number | null };

/**
 * A recipe's foods to buy, each line as edited here, split by whether the Pantry holds it; and
 * what puts lines on the list. `lines` come from `useRecipeFoodsToBuy`.
 */
export function useLinesToBuy<T extends ScaledFood>(
  lines: T[],
  editedIngredients: Record<string, EditedIngredient>
) {
  const { toast } = usePlatform();
  const { createGroceriesFromData } = useGroceriesMutations();
  const { addPantryIngredient } = usePantryMutations();
  // A line whose food the Pantry holds is shown apart and left off the list unless ticked; a line
  // edited here is only text, so it is matched by its name.
  const pantry = usePantryQuery();
  const rules = useSpellingRules();
  // One add per opened sheet: a second tap before the sheet closes must not mint the lines again.
  const addingRef = useRef(false);
  const [isAdding, setIsAdding] = useState(false);

  /** The Pantry Ingredient that covers a line, as edited here if it was. */
  const keptFor = (item: GroceryIngredient) => {
    const edited = editedIngredients[item.id]?.name;

    return pantryIngredientFor(
      pantry.items,
      edited === undefined ? item : { ingredientName: edited },
      rules
    );
  };
  const toBuy: T[] = [];
  const inPantry: T[] = [];

  for (const item of lines) (keptFor(item) ? inPantry : toBuy).push(item);

  /** "We keep this": the line's food, or its edited name's resolved food, goes in the Pantry,
   * whose optimistic row moves the line under "In your pantry" at once. */
  const keepLine = (item: GroceryIngredient) => {
    const edited = editedIngredients[item.id]?.name;

    void addPantryIngredient(
      edited !== undefined || !item.ingredientId
        ? (edited ?? item.ingredientName)
        : { ingredientId: item.ingredientId, name: item.ingredientName }
    );
  };

  /** Puts these lines on the list, as edited here; true once they are on it, false if not added. */
  const addLines = (picked: Array<FoodToBuy<GroceryIngredient>>) => {
    if (addingRef.current) return Promise.resolve(false);
    addingRef.current = true;
    setIsAdding(true);

    return createGroceriesFromData(
      picked.map((ri) => ({
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
        addingRef.current = false;
        setIsAdding(false);

        return false;
      });
  };

  return { pantry, keptFor, keepLine, toBuy, inPantry, addLines, isAdding };
}
