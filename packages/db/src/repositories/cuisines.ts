/** Cuisines (ADR-0012, ADR-0043): the instance's beside the household's own. Created only by a
 * member's Add or the `extend` strategy; an import or the `existing` strategy only matches. */
import { asc, eq } from "drizzle-orm";

import type { CuisineSummaryDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { cuisines, recipeCuisines } from "@norish/db/schema";

import type { ListEntryRow } from "./list-entries";
import { entriesByFoldTx } from "./list-entries";

/** The household's (or instance's) Cuisines for `names`, created in the household when `create`. */
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
