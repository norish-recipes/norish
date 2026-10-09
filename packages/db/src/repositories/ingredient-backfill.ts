import { and, asc, eq, gt, isNotNull, isNull, notExists, sql } from "drizzle-orm";

import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredients,
  ingredientStorePreferences,
  ingredientSuggestions,
  pantryIngredients,
  recipeIngredients,
  recipes,
  recurringGroceries,
  storeProductLinks,
} from "@norish/db/schema";

/**
 * The upgrade to Ingredient Aliases (ADR-0037), as the startup backfill reads
 * and writes it: rows written before aliases existed, listed by cursor, and
 * each one's answer from the ingredient resolver stored back. The links that
 * were keyed by a folded name are carried over in `legacy-link-backfill`.
 * Nothing here decides identity; the resolver does, above this package.
 */

/** A reference the backfill has resolved: the row, and the alias and Ingredient its text resolved to. */
export type ResolvedReference = { id: string } & IngredientRef;

/**
 * Recipe lines written before aliases existed, with their amount and unit and
 * the recipe's owner, after the given id. A `#` heading names no food and
 * never has an alias, so it is never listed.
 */
export async function listRecipeLinesWithoutAlias(
  limit: number,
  afterId: string | null = null
): Promise<
  Array<{
    id: string;
    name: string;
    amount: string | null;
    unit: string | null;
    userId: string | null;
  }>
> {
  return await db
    .select({
      id: recipeIngredients.id,
      name: recipeIngredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      userId: recipes.userId,
    })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(
      and(
        isNull(recipeIngredients.ingredientAliasId),
        sql`${recipeIngredients.name} !~ '^\\s*#'`,
        afterId ? gt(recipeIngredients.id, afterId) : undefined
      )
    )
    .orderBy(asc(recipeIngredients.id))
    .limit(limit);
}

/** Point recipe lines at their aliases; a line reaches its Ingredient through the alias. */
export async function setRecipeLineAliases(rows: readonly ResolvedReference[]): Promise<void> {
  for (const row of rows) {
    await db
      .update(recipeIngredients)
      .set({ ingredientAliasId: row.aliasId })
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
 * Remove the `ingredients` rows written before aliases existed that the
 * upgrade left behind: no spelling reaches them, since every reference was
 * resolved from its text instead, and nothing points at them any more. An
 * Ingredient made since always keeps a spelling, so only those rows match.
 * How many were removed.
 */
export async function removeIngredientsWithoutSpelling(): Promise<number> {
  const removed = await db.execute(sql`
    delete from ${ingredients} i
     where i.off_id is null
       and not exists (select 1 from ${ingredientAliases} r where r.ingredient_id = i.id)
       and not exists (select 1 from ${pantryIngredients} r where r.ingredient_id = i.id)
       and not exists (select 1 from ${groceries} r where r.ingredient_id = i.id)
       and not exists (select 1 from ${recurringGroceries} r where r.ingredient_id = i.id)
       and not exists (select 1 from ${aisleLinks} r where r.ingredient_id = i.id)
       and not exists (select 1 from ${storeProductLinks} r where r.ingredient_id = i.id)
       and not exists (select 1 from ${ingredientStorePreferences} r where r.ingredient_id = i.id)
       and not exists (select 1 from ${ingredientNutritionCorrections} r where r.ingredient_id = i.id)
       and not exists (
         select 1 from ${ingredientSuggestions} r where r.ingredient_id = i.id or r.target_id = i.id
       )
       and not exists (select 1 from ${ingredients} k where k.parent_id = i.id)
  `);

  return removed.rowCount ?? 0;
}
