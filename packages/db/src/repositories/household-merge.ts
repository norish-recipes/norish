/** Joining from a household of one merges it into the joined household (ADR-0041): everything it
 * holds moves, in the join's transaction, before the emptied household is deleted. */
import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { DbTransaction } from "@norish/db/drizzle";
import {
  groceries,
  ingredientNutritionCorrections,
  ingredientStorePreferences,
  pantryIngredients,
  plannedItems,
  recurringGroceries,
  stores,
} from "@norish/db/schema";

import { mergeCatalogueIntoTx } from "./ingredient-relocation";
import { moveHouseholdEntriesTx } from "./list-entries";

const qb = new QueryBuilder();

/** Moved as they are: groceries and plans; Stores too, with their aisles, products and links. */
const MOVED_WHOLE = [groceries, recurringGroceries, plannedItems] as const;

/** One per household and food: where both hold one, the joined household's stays, as its members
 * set it and see it; the joiner's goes. */
const ONE_PER_FOOD = [
  pantryIngredients,
  ingredientNutritionCorrections,
  ingredientStorePreferences,
] as const;

/** Moves the household-owned rows of `from` into `into`; set-based, so any number moves at once. */
export async function moveHouseholdRowsTx(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<void> {
  await fillCorrectionsTx(tx, from, into);
  for (const table of ONE_PER_FOOD) {
    // The inner `table` is the joined household's rows.
    await tx
      .delete(table)
      .where(
        and(
          eq(table.householdId, from),
          inArray(
            table.ingredientId,
            qb.select({ id: table.ingredientId }).from(table).where(eq(table.householdId, into))
          )
        )
      );
    await tx.update(table).set({ householdId: into }).where(eq(table.householdId, from));
  }
  // Both sets of Stores are kept, the joiner's after the household's.
  const last = qb
    .select({ order: max(stores.sortOrder) })
    .from(stores)
    .where(eq(stores.householdId, into));

  await tx
    .update(stores)
    .set({ householdId: into, sortOrder: sql`${stores.sortOrder} + coalesce((${last}), -1) + 1` })
    .where(eq(stores.householdId, from));
  for (const table of MOVED_WHOLE) {
    await tx.update(table).set({ householdId: into }).where(eq(table.householdId, from));
  }
}

/** The fields of a correction that stand together: the numbers, the piece weight, the density. */
const CORRECTION_GROUPS = [
  ["numbersFood", "kcal", "fat", "carbs", "protein", "extras"],
  ["pieceWeightFood", "pieceWeight"],
  ["densityFood", "density"],
] as const;

/** Where both households correct one food, a group the joined household's row leaves empty takes
 * the joiner's; the household's own values win. */
async function fillCorrectionsTx(tx: DbTransaction, from: string, into: string): Promise<void> {
  const joiner = alias(ingredientNutritionCorrections, "joiner_correction");
  const set = Object.fromEntries(
    CORRECTION_GROUPS.flatMap((group) => {
      const empty = and(...group.map((field) => isNull(ingredientNutritionCorrections[field])));

      return group.map((field) => [
        field,
        sql`case when ${empty} then ${joiner[field]} else ${ingredientNutritionCorrections[field]} end`,
      ]);
    })
  );

  await tx
    .update(ingredientNutritionCorrections)
    .set(set)
    .from(joiner)
    .where(
      and(
        eq(ingredientNutritionCorrections.householdId, into),
        eq(joiner.householdId, from),
        eq(joiner.ingredientId, ingredientNutritionCorrections.ingredientId)
      )
    );
}

/** Merges a household of one into `into`, after its member's membership moved (the triggers took
 * the recipes and cookbooks): its lists, then its catalogue (the tree, then the foods), then the
 * rows naming those foods, so a Pantry duplicate is found on the food it ends on. */
export async function mergeHouseholdTx(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<void> {
  await moveHouseholdEntriesTx(tx, from, into);
  await mergeCatalogueIntoTx(tx, from, into);
  await moveHouseholdRowsTx(tx, from, into);
}
