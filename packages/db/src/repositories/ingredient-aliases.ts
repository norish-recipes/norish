import { and, asc, eq, gt, inArray, isNotNull, isNull, notExists, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import {
  groceries,
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredients,
  recipes,
  recurringGroceries,
} from "@norish/db/schema";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

/**
 * The Ingredient Alias rows the ingredient resolver reads and writes. Nothing
 * but the resolver (in `@norish/shared-server/ingredients`) and the startup
 * backfill calls the writers here: they are the only paths that mint
 * Ingredients or aliases (ADR-0037).
 */

/** An alias as the resolver sees it: its text, its fold and its Ingredient. */
export interface IngredientAliasRow {
  aliasId: string;
  text: string;
  fold: string;
  ingredientId: string;
}

/** An Ingredient as a reader of the catalogue sees it. */
export interface IngredientRow {
  id: string;
  name: string;
  ownerId: string | null;
  flagged: boolean;
}

const aliasColumns = {
  aliasId: ingredientAliases.id,
  text: ingredientAliases.text,
  fold: ingredientAliases.fold,
  ingredientId: ingredientAliases.ingredientId,
};

export async function findIngredientAliasesByFolds(
  folds: readonly string[]
): Promise<IngredientAliasRow[]> {
  const unique = Array.from(new Set(folds.filter((fold) => fold.length > 0)));

  if (unique.length === 0) return [];

  return await db
    .select(aliasColumns)
    .from(ingredientAliases)
    .where(inArray(ingredientAliases.fold, unique));
}

export async function findIngredientByAliasId(aliasId: string): Promise<IngredientRow | null> {
  const [row] = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      ownerId: ingredients.ownerId,
      flagged: ingredients.flagged,
    })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredientAliases.ingredientId, ingredients.id))
    .where(eq(ingredientAliases.id, aliasId))
    .limit(1);

  return row ?? null;
}

export async function findIngredientNamesByIds(
  ids: readonly string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));

  if (unique.length === 0) return new Map();

  const rows = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(inArray(ingredients.id, unique));

  return new Map(rows.map((row) => [row.id, row.name]));
}

export interface MintIngredientInput {
  name: string;
  /** The aliases to give it, the text that prompted the mint first. */
  aliases: ReadonlyArray<{ text: string; fold: string }>;
  ownerId: string | null;
  locale: string | null;
  flagged: boolean;
}

/**
 * Mint an Ingredient with its first aliases, and answer with the alias each
 * requested fold now has.
 *
 * Safe against a concurrent mint of the same spelling: an alias whose fold is
 * already taken keeps pointing where it points, and an Ingredient that ends up
 * with no alias of its own is removed again. A name that is already an
 * Ingredient's (regardless of case) is that Ingredient, so the aliases join it
 * and nothing is minted or flagged.
 */
export async function mintIngredientWithAliases(
  input: MintIngredientInput
): Promise<IngredientAliasRow[]> {
  const folds = input.aliases.map((alias) => alias.fold);

  return await db.transaction(async (tx) => {
    const [minted] = await tx
      .insert(ingredients)
      .values({
        name: input.name,
        normalizedName: normalizeGroceryName(input.name),
        ownerId: input.ownerId,
        flagged: input.flagged,
      })
      .onConflictDoNothing()
      .returning({ id: ingredients.id });

    const ingredientId =
      minted?.id ??
      (
        await tx
          .select({ id: ingredients.id })
          .from(ingredients)
          .where(eq(sql`lower(${ingredients.name})`, input.name.toLowerCase()))
          .limit(1)
      )[0]?.id;

    if (!ingredientId) throw new Error("Failed to mint or find ingredient");

    await tx
      .insert(ingredientAliases)
      .values(
        input.aliases.map((alias) => ({
          text: alias.text,
          fold: alias.fold,
          locale: input.locale,
          ingredientId,
          ownerId: input.ownerId,
        }))
      )
      .onConflictDoNothing();

    const rows = await tx
      .select(aliasColumns)
      .from(ingredientAliases)
      .where(inArray(ingredientAliases.fold, folds));

    if (minted && !rows.some((row) => row.ingredientId === minted.id)) {
      await tx.delete(ingredients).where(eq(ingredients.id, minted.id));
    }

    return rows;
  });
}

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
export async function setRecipeLineAliases(
  rows: ReadonlyArray<{ id: string; aliasId: string; ingredientId: string }>
): Promise<void> {
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
  rows: ReadonlyArray<{ id: string; aliasId: string; ingredientId: string }>
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

/** Recipe lines' texts and the aliases they resolved to, by line id. */
export async function findRecipeLineAliases(
  recipeIngredientIds: readonly string[]
): Promise<Map<string, { name: string; aliasId: string; ingredientId: string }>> {
  const unique = Array.from(new Set(recipeIngredientIds));

  if (unique.length === 0) return new Map();

  const rows = await db
    .select({
      id: recipeIngredients.id,
      name: recipeIngredients.name,
      aliasId: ingredientAliases.id,
      ingredientId: ingredientAliases.ingredientId,
    })
    .from(recipeIngredients)
    .innerJoin(ingredientAliases, eq(recipeIngredients.ingredientAliasId, ingredientAliases.id))
    .where(inArray(recipeIngredients.id, unique));

  return new Map(rows.map(({ id, ...line }) => [id, line]));
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

export async function setGroceryAliases(
  rows: ReadonlyArray<{ id: string; aliasId: string }>
): Promise<void> {
  for (const row of rows) {
    await db
      .update(groceries)
      .set({ ingredientAliasId: row.aliasId })
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
  rows: ReadonlyArray<{ id: string; aliasId: string }>
): Promise<void> {
  for (const row of rows) {
    await db
      .update(recurringGroceries)
      .set({ ingredientAliasId: row.aliasId })
      .where(and(eq(recurringGroceries.id, row.id), isNull(recurringGroceries.ingredientAliasId)));
  }
}
