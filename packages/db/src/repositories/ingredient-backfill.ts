import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, gt, isNotNull, isNull, notExists, sql } from "drizzle-orm";

import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  ingredientAliases,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recipeIngredients,
  recipes,
  recurringGroceries,
  storeProductLinks,
  stores,
} from "@norish/db/schema";

/**
 * The upgrade to Ingredient Aliases (ADR-0037), as the startup backfill reads
 * and writes it: rows written before aliases existed, listed by cursor, and
 * each one's answer from the ingredient resolver stored back. Nothing here
 * decides identity; the resolver does, above this package.
 */

/** A reference the backfill has resolved: the row, and the alias and Ingredient its text resolved to. */
export type ResolvedReference = { id: string } & IngredientRef;

/**
 * Ingredients written before aliases existed that have no alias yet, oldest
 * first, after the given one. The startup backfill gives each its own name as
 * its first alias; one whose spelling another already holds stays without, so
 * the walk moves on by cursor rather than by what is left.
 */
export async function listIngredientsWithoutAlias(
  limit: number,
  after: { createdAt: string; id: string } | null
): Promise<Array<{ id: string; name: string; ownerId: string | null; createdAt: string }>> {
  return await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      ownerId: ingredients.ownerId,
      // As text, so the cursor keeps the microseconds a Date would drop.
      createdAt: sql<string>`${ingredients.createdAt}::text`,
    })
    .from(ingredients)
    .where(
      and(
        notExists(
          db
            .select({ one: sql`1` })
            .from(ingredientAliases)
            .where(eq(ingredientAliases.ingredientId, ingredients.id))
        ),
        after
          ? sql`(${ingredients.createdAt}, ${ingredients.id}) > (${after.createdAt}::timestamptz, ${after.id}::uuid)`
          : undefined
      )
    )
    .orderBy(asc(ingredients.createdAt), asc(ingredients.id))
    .limit(limit);
}

/**
 * Give an existing Ingredient its own name as an alias. A fold another
 * Ingredient already holds is left where it is: the names fold alike, so the
 * first Ingredient to hold the spelling keeps it and this one resolves there.
 */
export async function addOwnNameAliases(
  rows: ReadonlyArray<{ ingredientId: string; text: string; fold: string; ownerId: string | null }>
): Promise<void> {
  if (rows.length === 0) return;

  await db
    .insert(ingredientAliases)
    .values([...rows])
    .onConflictDoNothing();
}

/** Recipe lines written before aliases existed, with the recipe's owner, after the given id. */
export async function listRecipeLinesWithoutAlias(
  limit: number,
  afterId: string | null = null
): Promise<Array<{ id: string; name: string; userId: string | null }>> {
  return await db
    .select({ id: recipeIngredients.id, name: recipeIngredients.name, userId: recipes.userId })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(
      and(
        isNull(recipeIngredients.ingredientAliasId),
        afterId ? gt(recipeIngredients.id, afterId) : undefined
      )
    )
    .orderBy(asc(recipeIngredients.id))
    .limit(limit);
}

/**
 * Point recipe lines at their aliases, and at each alias's Ingredient, which
 * differs from the line's old Ingredient only where two names folded alike.
 */
export async function setRecipeLineAliases(rows: readonly ResolvedReference[]): Promise<void> {
  for (const row of rows) {
    await db
      .update(recipeIngredients)
      .set({ ingredientAliasId: row.aliasId, ingredientId: row.ingredientId })
      .where(and(eq(recipeIngredients.id, row.id), isNull(recipeIngredients.ingredientAliasId)));
  }
}

/** Pantry Ingredients written before aliases existed, with their Ingredient's name. */
export async function listPantryIngredientsWithoutAlias(
  limit: number,
  afterId: string | null = null
): Promise<Array<{ id: string; name: string; userId: string }>> {
  return await db
    .select({ id: pantryIngredients.id, name: ingredients.name, userId: pantryIngredients.userId })
    .from(pantryIngredients)
    .innerJoin(ingredients, eq(pantryIngredients.ingredientId, ingredients.id))
    .where(
      and(
        isNull(pantryIngredients.ingredientAliasId),
        afterId ? gt(pantryIngredients.id, afterId) : undefined
      )
    )
    .orderBy(asc(pantryIngredients.id))
    .limit(limit);
}

/**
 * Point Pantry Ingredients at their aliases and each alias's Ingredient. A
 * member who held two names that fold alike held one food twice; the second
 * row is that food again, so it goes rather than break the one-per-member
 * rule.
 */
export async function setPantryIngredientAliases(
  rows: readonly ResolvedReference[]
): Promise<void> {
  for (const row of rows) {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(pantryIngredients)
        .set({ ingredientAliasId: row.aliasId, ingredientId: row.ingredientId })
        .where(
          and(
            eq(pantryIngredients.id, row.id),
            isNull(pantryIngredients.ingredientAliasId),
            notExists(
              tx
                .select({ one: sql`1` })
                .from(sql`${pantryIngredients} as held`)
                .where(
                  sql`held.user_id = ${pantryIngredients.userId} and held.ingredient_id = ${row.ingredientId} and held.id <> ${row.id}`
                )
            )
          )
        )
        .returning({ id: pantryIngredients.id });

      if (!updated) {
        await tx
          .delete(pantryIngredients)
          .where(
            and(eq(pantryIngredients.id, row.id), isNull(pantryIngredients.ingredientAliasId))
          );
      }
    });
  }
}

/** Named groceries written before aliases existed, after the given id. */
export async function listGroceriesWithoutAlias(
  limit: number,
  afterId: string | null = null
): Promise<Array<{ id: string; name: string; userId: string }>> {
  const rows = await db
    .select({ id: groceries.id, name: groceries.name, userId: groceries.userId })
    .from(groceries)
    .where(
      and(
        isNull(groceries.ingredientAliasId),
        isNotNull(groceries.name),
        sql`trim(${groceries.name}) <> ''`,
        afterId ? gt(groceries.id, afterId) : undefined
      )
    )
    .orderBy(asc(groceries.id))
    .limit(limit);

  return rows.map((row) => ({ ...row, name: row.name ?? "" }));
}

export async function setGroceryAliases(rows: readonly ResolvedReference[]): Promise<void> {
  for (const row of rows) {
    await db
      .update(groceries)
      .set({ ingredientAliasId: row.aliasId, ingredientId: row.ingredientId })
      .where(and(eq(groceries.id, row.id), isNull(groceries.ingredientAliasId)));
  }
}

/** Recurring groceries written before aliases existed, after the given id. */
export async function listRecurringGroceriesWithoutAlias(
  limit: number,
  afterId: string | null = null
): Promise<Array<{ id: string; name: string; userId: string }>> {
  return await db
    .select({
      id: recurringGroceries.id,
      name: recurringGroceries.name,
      userId: recurringGroceries.userId,
    })
    .from(recurringGroceries)
    .where(
      and(
        isNull(recurringGroceries.ingredientAliasId),
        afterId ? gt(recurringGroceries.id, afterId) : undefined
      )
    )
    .orderBy(asc(recurringGroceries.id))
    .limit(limit);
}

export async function setRecurringGroceryAliases(
  rows: readonly ResolvedReference[]
): Promise<void> {
  for (const row of rows) {
    await db
      .update(recurringGroceries)
      .set({ ingredientAliasId: row.aliasId, ingredientId: row.ingredientId })
      .where(and(eq(recurringGroceries.id, row.id), isNull(recurringGroceries.ingredientAliasId)));
  }
}

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
