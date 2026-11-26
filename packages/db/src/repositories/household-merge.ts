/** Joining from a household of one merges it into the joined household (ADR-0041): everything it
 * holds moves, in the join's transaction, before the emptied household is deleted. */
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

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

import { mergeHouseholdCatalogueTx } from "./household-catalogue";
import { mergeHouseholdEntriesTx } from "./list-entries";

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
export async function mergeHouseholdRowsTx(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<void> {
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

/** Merges a household of one into `into`, after its member's membership moved (the triggers took
 * the recipes and cookbooks): its lists, then its catalogue (the tree, then the foods), then the
 * rows naming those foods, so a Pantry duplicate is found on the food it ends on. */
export async function mergeHouseholdTx(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<void> {
  await mergeHouseholdEntriesTx(tx, from, into);
  await mergeHouseholdCatalogueTx(tx, from, into);
  await mergeHouseholdRowsTx(tx, from, into);
}
