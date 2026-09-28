import type { PantryIngredientDto } from "@norish/shared/contracts";
import { addPantryIngredient } from "@norish/db/repositories/pantry";

import { resolveIngredient } from "./resolver";

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
  const resolved = await resolveIngredient(input.name, { userId: input.userId });

  if (!resolved) throw new Error("Failed to resolve pantry ingredient");

  return await addPantryIngredient(id, {
    userId: input.userId,
    userIds: input.userIds,
    ingredientAliasId: resolved.aliasId,
    ingredientId: resolved.ingredientId,
  });
}
