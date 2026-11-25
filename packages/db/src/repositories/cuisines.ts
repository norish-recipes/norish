/**
 * Cuisines (ADR-0012, ADR-0043): the administrator's are instance entries every household is
 * offered, beside the household's own. Created only by a member's Add or the `extend` strategy;
 * an import or the `existing` strategy only matches.
 */
import { asc, eq } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import type { CuisineSummaryDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { cuisines, recipeCuisines } from "@norish/db/schema";

import type { ListEntryRow } from "./list-entries";
import { entriesByFoldTx, listEntryRows, replaceRecipeEntryIdsTx } from "./list-entries";

/** The household's Cuisines and the instance's, by name. */
export function listCuisinesForHousehold(householdId: string): Promise<ListEntryRow[]> {
  return listEntryRows("cuisine", householdId);
}

/** The household's (or instance's) Cuisines for `names` by fold, created in the household when `create`. */
export async function cuisinesForNames(
  householdId: string,
  names: readonly string[],
  options: { create: boolean }
): Promise<ListEntryRow[]> {
  const found = await db.transaction((tx) =>
    entriesByFoldTx(tx, "cuisine", householdId, names, options)
  );

  return [...found.values()];
}

/** A recipe's Cuisines, in the order they were attached. */
export async function getRecipeCuisines(recipeId: string): Promise<CuisineSummaryDto[]> {
  return await db
    .select({ id: cuisines.id, name: cuisines.name, version: cuisines.version })
    .from(recipeCuisines)
    .innerJoin(cuisines, eq(recipeCuisines.cuisineId, cuisines.id))
    .where(eq(recipeCuisines.recipeId, recipeId))
    .orderBy(asc(recipeCuisines.order));
}

/**
 * Replace a recipe's Cuisines with `cuisineIds`: its household's, the instance's, or ones it
 * already carries; any other refuses the write (ForeignHouseholdReferenceError).
 */
export async function replaceRecipeCuisinesTx(
  tx: DbTransaction,
  recipeId: string,
  cuisineIds: readonly string[]
): Promise<void> {
  await replaceRecipeEntryIdsTx(tx, "cuisine", recipeId, cuisineIds);
}
