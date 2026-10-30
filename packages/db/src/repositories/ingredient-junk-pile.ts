import { inArray } from "drizzle-orm";

import type { Db } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { ingredientJunkPile } from "@norish/db/schema";

/**
 * The junk pile (CONTEXT.md): folds of texts that name no food. Why one is there: AI deleted its
 * food or a spelling as not a food, a person said so, or the seed lists it.
 */
export type JunkReason = "not-a-food" | "person" | "seed";

/** Every fold on the pile, for the resolver's rules. */
export async function listJunkFolds(tx: Db = db): Promise<string[]> {
  const rows = await tx.select({ fold: ingredientJunkPile.fold }).from(ingredientJunkPile);

  return rows.map((row) => row.fold);
}

/**
 * Put folds on the pile, with the AI Change that put them there where one did; a fold already
 * there keeps its entry. How many were added.
 */
export async function addToJunkPile(
  tx: Db,
  folds: readonly string[],
  { reason, aiChangeId = null }: { reason: JunkReason; aiChangeId?: string | null }
): Promise<number> {
  const unique = [...new Set(folds.filter((fold) => fold.length > 0))];

  if (unique.length === 0) return 0;
  const added = await tx
    .insert(ingredientJunkPile)
    .values(unique.map((fold) => ({ fold, reason, aiChangeId })))
    .onConflictDoNothing({ target: ingredientJunkPile.fold })
    .returning({ id: ingredientJunkPile.id });

  return added.length;
}

/** Take folds off the pile, a person having said they name a food (a spelling added, an Undo). */
export async function takeOffJunkPile(tx: Db, folds: readonly string[]): Promise<number> {
  if (folds.length === 0) return 0;
  const taken = await tx
    .delete(ingredientJunkPile)
    .where(inArray(ingredientJunkPile.fold, [...folds]))
    .returning({ id: ingredientJunkPile.id });

  return taken.length;
}
