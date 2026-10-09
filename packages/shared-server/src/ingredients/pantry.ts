import type { PantryIngredientDto } from "@norish/shared/contracts";
import { addPantryIngredient, findIngredientOwnSpelling } from "@norish/db/repositories/pantry";

import { resolveIngredient, writeResolved } from "./resolver";

/**
 * Put what a member typed in the Pantry: the text is resolved like any recipe
 * line, so "Onions" and "onions, chopped" are the one Ingredient, and a food
 * the household already has is answered with the item it holds rather than
 * a second one (`created: false`).
 */
export async function addToPantry(
  id: string,
  input: { userId: string; userIds: string[]; name: string }
): Promise<{ item: PantryIngredientDto; created: boolean }> {
  return await writeResolved(
    () => resolveIngredient(input.name, { userId: input.userId }),
    async (resolved) => {
      if (!resolved) throw new Error("Failed to resolve pantry ingredient");

      return await addPantryIngredient(id, {
        userId: input.userId,
        userIds: input.userIds,
        ingredientAliasId: resolved.aliasId,
        ingredientId: resolved.ingredientId,
      });
    }
  );
}

/**
 * Put a food a member picked in the Pantry: the Ingredient as picked, with
 * no resolver call, the row pointing at the Ingredient's own spelling. A
 * food the household already keeps is answered with the item it holds; null
 * where the Ingredient is gone (merged away or deleted since it was picked).
 */
export async function addPickedToPantry(
  id: string,
  input: { userId: string; userIds: string[]; ingredientId: string }
): Promise<{ item: PantryIngredientDto; created: boolean } | null> {
  const spelling = await findIngredientOwnSpelling(input.ingredientId);

  if (!spelling) return null;

  return await addPantryIngredient(id, {
    userId: input.userId,
    userIds: input.userIds,
    ...spelling,
  });
}
