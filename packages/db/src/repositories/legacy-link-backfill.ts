import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  ingredientStorePreferences,
  recurringGroceries,
  storeProductLinks,
  stores,
} from "@norish/db/schema";

/**
 * The upgrade of the three memories that were keyed by a folded name before
 * ADR-0037 — Product Links, Aisle Links and store preferences — to a key on
 * the Ingredient, as the startup backfill reads and writes it. Each legacy
 * row is keyed by the food its household's grocery of that name resolved to.
 */

/**
 * Every grocery and recurring grocery name the household lists, with the
 * Ingredient it resolved to: what the link carry-over reads a legacy folded
 * key against, so a link lands on the food its grocery did.
 */
export async function listResolvedGroceryNames(): Promise<
  Array<{ name: string; ingredientId: string }>
> {
  const rows = await db
    .selectDistinct({ name: groceries.name, ingredientId: groceries.ingredientId })
    .from(groceries)
    .where(and(isNotNull(groceries.name), isNotNull(groceries.ingredientId)))
    .union(
      db
        .selectDistinct({
          name: recurringGroceries.name,
          ingredientId: recurringGroceries.ingredientId,
        })
        .from(recurringGroceries)
        .where(isNotNull(recurringGroceries.ingredientId))
    );

  return rows.flatMap((row) =>
    row.name && row.ingredientId ? [{ name: row.name, ingredientId: row.ingredientId }] : []
  );
}

/**
 * The three memories that were keyed by a folded name before ADR-0037: each
 * with the column its uniqueness is scoped by (a Store, or a member) and the
 * member who owns a row (a link belongs to its Store's owner).
 */
const LEGACY_KEYED = {
  productLinks: {
    table: storeProductLinks,
    scope: storeProductLinks.storeId,
    scopeColumn: sql.raw("store_id"),
  },
  aisleLinks: { table: aisleLinks, scope: aisleLinks.storeId, scopeColumn: sql.raw("store_id") },
  storePreferences: {
    table: ingredientStorePreferences,
    scope: ingredientStorePreferences.userId,
    scopeColumn: sql.raw("user_id"),
  },
} as const;

export type LegacyKeyedTable = keyof typeof LEGACY_KEYED;

/** A row still keyed by its folded name, newest first: the newest wins a collision. */
export interface LegacyKeyedRow {
  id: string;
  normalizedName: string;
  ownerId: string;
}

/** A row still waiting for its Ingredient, and with a folded name to find it by. */
function stillKeyedByName(table: LegacyKeyedTable): SQL | undefined {
  const { table: rows } = LEGACY_KEYED[table];

  return and(isNull(rows.ingredientId), sql`coalesce(${rows.normalizedName}, '') <> ''`);
}

export async function listLegacyKeyedRows(
  table: LegacyKeyedTable,
  limit: number
): Promise<LegacyKeyedRow[]> {
  const { table: rows } = LEGACY_KEYED[table];
  const listed =
    table === "storePreferences"
      ? await db
          .select({
            id: ingredientStorePreferences.id,
            normalizedName: ingredientStorePreferences.normalizedName,
            ownerId: ingredientStorePreferences.userId,
          })
          .from(ingredientStorePreferences)
          .where(stillKeyedByName(table))
          .orderBy(desc(ingredientStorePreferences.updatedAt), asc(ingredientStorePreferences.id))
          .limit(limit)
      : await db
          .select({ id: rows.id, normalizedName: rows.normalizedName, ownerId: stores.userId })
          .from(rows)
          .innerJoin(stores, eq(stores.id, LEGACY_KEYED[table].scope))
          .where(stillKeyedByName(table))
          .orderBy(desc(rows.updatedAt), asc(rows.id))
          .limit(limit);

  return listed.map((row) => ({ ...row, normalizedName: row.normalizedName ?? "" }));
}

/** Drop a legacy row whose name names no food, so the walk moves past it. */
export async function dropLegacyRow(table: LegacyKeyedTable, id: string): Promise<void> {
  const { table: rows } = LEGACY_KEYED[table];

  await db.delete(rows).where(and(eq(rows.id, id), isNull(rows.ingredientId)));
}

/**
 * Key a legacy row by its Ingredient. Where the same Store (or member)
 * already holds a row for that Ingredient — a newer one, since rows are
 * carried over newest first — this one is the older of the two, and goes.
 * Returns whether the row was kept.
 */
export async function keyLegacyRow(
  table: LegacyKeyedTable,
  id: string,
  ingredientId: string
): Promise<boolean> {
  const { table: rows, scope, scopeColumn } = LEGACY_KEYED[table];

  return await db.transaction(async (tx) => {
    const [kept] = await tx
      .update(rows)
      .set({ ingredientId })
      .where(
        and(
          eq(rows.id, id),
          isNull(rows.ingredientId),
          sql`not exists (select 1 from ${rows} as held where held.${scopeColumn} = ${scope} and held.ingredient_id = ${ingredientId})`
        )
      )
      .returning({ id: rows.id });

    if (!kept) await tx.delete(rows).where(and(eq(rows.id, id), isNull(rows.ingredientId)));

    return Boolean(kept);
  });
}
