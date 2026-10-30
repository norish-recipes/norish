import type { NamingRows } from "@norish/db/repositories/ingredient-cleanup";
import {
  listGroceriesWithoutFood,
  listGroceryNamesWithFood,
  listLinesWithoutFood,
  listPantryIngredientsWithoutSpelling,
  listParkedLinks,
  listRecurringGroceriesWithoutFood,
  setPantryIngredientFood,
  unparkLink,
} from "@norish/db/repositories/upgrades";
import { resolveAgain } from "@norish/shared-server/ingredients/resolve-again";
import { resolveIngredient, resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { readIngredientSeedState } from "@norish/shared-server/ingredients/seed/catalogue-seed";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

const BATCH_SIZE = 500;

/**
 * Rows from before 0.25 name a food through a spelling (ADR-0037), as an import with AI off reads
 * them; a text the catalogue lacks mints a flagged food. Links 0075 parked follow their groceries.
 */
export async function upgradeIngredients(): Promise<{ rows: number; links: number }> {
  return { rows: await upgradeRows(), links: await upgradeParkedLinks() };
}

/** Once 0.26's cleanup has run, a row naming no food lost it to a person's delete, and stays so. */
async function upgradeRows(): Promise<number> {
  if ((await readIngredientSeedState()).cleanupVersion > 0) return 0;

  return (
    (await resolveAll(listLinesWithoutFood, (lines) => ({ lines, groceries: [], recurring: [] }))) +
    (await resolveAll(listGroceriesWithoutFood, (groceries) => ({
      lines: [],
      groceries,
      recurring: [],
    }))) +
    (await resolveAll(listRecurringGroceriesWithoutFood, (recurring) => ({
      lines: [],
      groceries: [],
      recurring,
    }))) +
    (await upgradePantry())
  );
}

async function resolveAll<R extends { id: string }>(
  list: (limit: number, afterId: string | null) => Promise<R[]>,
  asRows: (batch: R[]) => NamingRows
): Promise<number> {
  let read = 0;

  for (let afterId: string | null = null; ;) {
    const batch = await list(BATCH_SIZE, afterId);

    if (batch.length === 0) return read;
    await resolveAgain(asRows(batch), "upgrade");
    read += batch.length;
    afterId = batch.at(-1)!.id;
  }
}

/** A Pantry Ingredient names the food its old Ingredient's name resolves to. */
async function upgradePantry(): Promise<number> {
  const pantry = await listPantryIngredientsWithoutSpelling();

  for (const ownerId of new Set(pantry.map((row) => row.ownerId))) {
    const owned = pantry.filter((row) => row.ownerId === ownerId);
    const foods = await resolveIngredients(
      owned.map((row) => row.name),
      { userId: ownerId },
      "upgrade"
    );

    for (const [index, row] of owned.entries()) {
      const food = foods[index];

      if (food) await setPantryIngredientFood(row.id, food);
    }
  }

  return pantry.length;
}

/**
 * A parked link is keyed by the food its household's grocery of that name names, else the food its
 * name resolves to; one naming none, or whose Store went, is dropped.
 */
async function upgradeParkedLinks(): Promise<number> {
  const groceryFoods = new Map<string, string>();

  for (const { name, ingredientId } of await listGroceryNamesWithFood()) {
    const fold = ingredientAliasFold(name);

    if (!groceryFoods.has(fold)) groceryFoods.set(fold, ingredientId);
  }

  let kept = 0;

  for (const parked of await listParkedLinks()) {
    const name = parked.link.normalized_name;
    const ingredientId = parked.ownerId
      ? (groceryFoods.get(ingredientAliasFold(name)) ??
        (await resolveIngredient(name, { userId: parked.ownerId }, "upgrade"))?.ingredientId ??
        null)
      : null;

    if (await unparkLink(parked, ingredientId)) kept += 1;
  }

  return kept;
}
