import type { PantryAdded } from "@norish/db/repositories/pantry";
import { addPantryIngredients, findIngredientOwnSpelling } from "@norish/db/repositories/pantry";

import { resolveIngredients, typedParts, writeResolved } from "./resolver";

/**
 * Put what a member typed in the Pantry, resolved like a recipe line: each food its words join
 * (`typedParts`), alternatives too, all or none. A food the household has answers `created: false`.
 */
export async function addToPantry(
  id: string,
  input: { userId: string; userIds: string[]; name: string }
): Promise<PantryAdded[]> {
  const typed: { id?: string; name: string } = { id, name: input.name };
  const [parts = [typed]] = await typedParts([typed], { alternatives: "each" });

  return await writeResolved(
    () =>
      resolveIngredients(
        parts.map((part) => part.name),
        { userId: input.userId }
      ),
    (foods) =>
      addPantryIngredients(
        parts.flatMap((part, index) => {
          const food = foods[index];

          return food
            ? [
                {
                  id: part.id ?? crypto.randomUUID(),
                  ingredientAliasId: food.aliasId,
                  ingredientId: food.ingredientId,
                },
              ]
            : [];
        }),
        input
      )
  );
}

/**
 * Put a food a member picked in the Pantry as picked, under its own spelling; none where the
 * Ingredient is gone (merged away or deleted since it was picked).
 */
export async function addPickedToPantry(
  id: string,
  input: { userId: string; userIds: string[]; ingredientId: string }
): Promise<PantryAdded[]> {
  const spelling = await findIngredientOwnSpelling(input.ingredientId);

  return spelling ? await addPantryIngredients([{ id, ...spelling }], input) : [];
}
