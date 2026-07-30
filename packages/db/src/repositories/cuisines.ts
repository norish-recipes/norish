/**
 * Cuisine vocabulary persistence.
 *
 * Cuisines and Tags share a shape and differ in governance (ADR-0012): a Tag is
 * minted freely by anyone including AI, a Cuisine only by an administrator or by
 * an explicitly permissive strategy. That difference lives here — this module
 * offers no `getOrCreate`, because "create it if it is missing" is exactly the
 * folksonomy behaviour the vocabulary exists to prevent.
 *
 * Every cuisine read and write is issued from this module, so no router, worker,
 * or migration composes its own query.
 */

import { asc, eq, inArray, sql } from "drizzle-orm";

import type { CuisineDto, CuisineSummaryDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { cuisines, recipeCuisines } from "@norish/db/schema";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

/** A transaction handle, or the pooled connection when there is no transaction. */
export type CuisineWriter = Pick<typeof db, "delete" | "insert">;

/** Names are canonical identifiers, so they are trimmed and never HTML. */
function cleanName(name: string): string {
  const cleaned = stripHtmlTags(name).trim();

  if (cleaned.length === 0) throw new Error("Cuisine name cannot be empty");

  return cleaned;
}

/** The vocabulary in display order. Name order is the only order it has. */
export async function listCuisines(): Promise<CuisineDto[]> {
  return await db
    .select()
    .from(cuisines)
    .orderBy(asc(sql`lower(${cuisines.name})`));
}

export async function findCuisineById(id: string): Promise<CuisineDto | null> {
  const rows = await db.select().from(cuisines).where(eq(cuisines.id, id)).limit(1);

  return rows[0] ?? null;
}

export async function findCuisineByName(name: string): Promise<CuisineDto | null> {
  const cleaned = cleanName(name);
  const rows = await db
    .select()
    .from(cuisines)
    // Compare case-insensitively; the stored value keeps its original casing.
    .where(eq(sql`lower(${cuisines.name})`, cleaned.toLowerCase()))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Add a Cuisine to the vocabulary.
 *
 * Throws on a duplicate rather than returning the existing row: an
 * administrator adding a name that is already there has made a mistake worth
 * reporting, and silently succeeding would hide it.
 */
export async function createCuisine(name: string): Promise<CuisineDto> {
  const cleaned = cleanName(name);
  const created = await db
    .insert(cuisines)
    .values({ name: cleaned })
    .onConflictDoNothing()
    .returning();

  if (!created[0]) {
    throw new Error(`Cuisine already exists: ${cleaned}`);
  }

  return created[0];
}

/**
 * Add several Cuisines at once, skipping the ones that are already there.
 *
 * The only bulk create there is, and it exists for the `extend` cuisine
 * strategy alone. Unlike {@link createCuisine} it tolerates a name that already
 * exists, because two provenance runs may propose the same new Cuisine at the
 * same time and neither should fail for it.
 *
 * @returns the rows for every requested name, created or pre-existing
 */
export async function createCuisines(names: readonly string[]): Promise<CuisineDto[]> {
  const cleaned = [...new Set(names.map((name) => cleanName(name)))];

  if (cleaned.length === 0) return [];

  return await db.transaction(async (tx) => {
    await tx
      .insert(cuisines)
      .values(cleaned.map((name) => ({ name })))
      .onConflictDoNothing();

    return await tx
      .select()
      .from(cuisines)
      .where(
        inArray(
          sql`lower(${cuisines.name})`,
          cleaned.map((name) => name.toLowerCase())
        )
      );
  });
}

/**
 * Rename a Cuisine.
 *
 * One row is written and every recipe referencing it follows, which is why the
 * vocabulary is a join rather than a string column on the recipe.
 */
export async function renameCuisine(id: string, name: string): Promise<CuisineDto | null> {
  const cleaned = cleanName(name);
  const conflict = await findCuisineByName(cleaned);

  if (conflict && conflict.id !== id) {
    // Merging two Cuisines is deliberately not an operation, so a rename onto an
    // existing name is a mistake rather than a merge request.
    throw new Error(`Cuisine already exists: ${cleaned}`);
  }

  const updated = await db
    .update(cuisines)
    .set({ name: cleaned, version: sql`${cuisines.version} + 1` })
    .where(eq(cuisines.id, id))
    .returning();

  return updated[0] ?? null;
}

/**
 * Remove a Cuisine from the vocabulary.
 *
 * A silent cascade: the join rows go with it and recipes that referenced it
 * simply lose it. Their provenance notes may now argue for a Cuisine that is no
 * longer listed; that drift is accepted and deliberately not repaired.
 */
export async function deleteCuisine(id: string): Promise<boolean> {
  const deleted = await db
    .delete(cuisines)
    .where(eq(cuisines.id, id))
    .returning({ id: cuisines.id });

  return deleted.length > 0;
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
 * Replace a recipe's Cuisines.
 *
 * Takes ids rather than names because the caller has already resolved names
 * against the vocabulary; accepting names here would reintroduce the
 * create-on-write behaviour this module refuses.
 */
export async function replaceRecipeCuisinesTx(
  tx: CuisineWriter,
  recipeId: string,
  cuisineIds: readonly string[]
): Promise<void> {
  await tx.delete(recipeCuisines).where(eq(recipeCuisines.recipeId, recipeId));

  const unique = [...new Set(cuisineIds)];

  if (unique.length === 0) return;

  await tx
    .insert(recipeCuisines)
    .values(unique.map((cuisineId, order) => ({ recipeId, cuisineId, order })))
    .onConflictDoNothing();
}

/** {@link replaceRecipeCuisinesTx} for callers that are not already in a transaction. */
export async function attachRecipeCuisines(
  recipeId: string,
  cuisineIds: readonly string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await replaceRecipeCuisinesTx(tx, recipeId, cuisineIds);
  });
}
