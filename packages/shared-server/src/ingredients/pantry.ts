import type { PantryAdded } from "@norish/db/repositories/pantry";
import { findRecipeLineAliases } from "@norish/db/repositories/ingredient-aliases";
import { addPantryIngredients, findIngredientOwnSpelling } from "@norish/db/repositories/pantry";

import { readLines } from "./line-readings";
import { resolveIngredients, typedParts, writeResolved } from "./resolver";

/**
 * Put what a member typed in the Pantry, resolved like a recipe line: each food its words join
 * (`typedParts`), alternatives too, all or none. A food the household has answers `created: false`.
 */
export async function addToPantry(
  id: string,
  input: { userId: string; householdId: string; name: string }
): Promise<PantryAdded[]> {
  const typed: { id?: string; name: string } = { id, name: input.name };
  const [parts = [typed]] = await typedParts(input.householdId, [typed], { alternatives: "each" });

  return await writeResolved(
    () =>
      resolveIngredients(
        parts.map((part) => part.name),
        { userId: input.userId, householdId: input.householdId }
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
 * Ingredient is gone (merged away or deleted since it was picked). Picked off a recipe line read
 * through the household's catalogue (ADR-0042), it is the food at that place as the line reads
 * there, else the line's own text resolved there; another household's food is never kept.
 */
export async function addPickedToPantry(
  id: string,
  input: { userId: string; householdId: string; ingredientId: string; recipeIngredientId?: string }
): Promise<PantryAdded[]> {
  const spelling = await findIngredientOwnSpelling(input.householdId, input.ingredientId);

  if (spelling) return await addPantryIngredients([{ id, ...spelling }], input);
  if (!input.recipeIngredientId) return [];

  const lineId = input.recipeIngredientId;
  const [read, stored] = await Promise.all([
    readLines(input.householdId, { of: "lines", ids: [lineId] }),
    findRecipeLineAliases([lineId], input.householdId),
  ]);
  const line = read.get(lineId);
  const place = stored
    .get(lineId)
    ?.foods.findIndex((food) => food.ingredientId === input.ingredientId);

  if (!line || place === undefined || place < 0) return [];
  const food = line.foods[place];

  return food
    ? await addPantryIngredients(
        [{ id, ingredientAliasId: food.aliasId, ingredientId: food.ingredientId }],
        input
      )
    : await addToPantry(id, { ...input, name: line.meaning });
}
