import type { PantryAdded } from "@norish/db/repositories/pantry";
import { findRecipeLineAliases } from "@norish/db/repositories/ingredient-aliases";
import { addPantryIngredients, findIngredientOwnSpelling } from "@norish/db/repositories/pantry";

import { chipFood, readLines } from "./line-readings";
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
 * through the household's catalogue (ADR-0042), it is the line's food there (`chipFood`), else the
 * line's own text resolved there; another household's food is never kept.
 */
export async function addPickedToPantry(
  id: string,
  input: { userId: string; householdId: string; ingredientId: string; recipeIngredientId?: string }
): Promise<PantryAdded[]> {
  const lineIds = input.recipeIngredientId ? [input.recipeIngredientId] : [];
  const [read, stored] = await Promise.all([
    readLines(input.householdId, { of: "lines", ids: lineIds }),
    findRecipeLineAliases(lineIds, input.householdId),
  ]);
  const line = read.get(lineIds[0] ?? "");
  const chip = line && chipFood(line, stored.get(lineIds[0] ?? "")?.foods, input.ingredientId);

  if (line && chip) {
    return chip.food
      ? await addPantryIngredients(
          [{ id, ingredientAliasId: chip.food.aliasId, ingredientId: chip.food.ingredientId }],
          input
        )
      : await addToPantry(id, { ...input, name: line.meaning });
  }
  const spelling = await findIngredientOwnSpelling(input.householdId, input.ingredientId);

  return spelling ? await addPantryIngredients([{ id, ...spelling }], input) : [];
}
