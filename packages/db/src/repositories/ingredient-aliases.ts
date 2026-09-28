import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { ingredientAliases, ingredients, recipeIngredients } from "@norish/db/schema";

/**
 * The Ingredient Alias rows the ingredient resolver reads and writes. Nothing
 * but the resolver (in `@norish/shared-server/ingredients`) and the startup
 * backfill calls the writers here: they are the only paths that mint
 * Ingredients or aliases (ADR-0037). The upgrade's carry-over of rows
 * written before aliases existed is `ingredient-backfill`.
 */

/**
 * An alias and the Ingredient it points at: what every reference to a food —
 * a recipe line, a Grocery, a Pantry Ingredient — stores.
 */
export interface IngredientRef {
  aliasId: string;
  ingredientId: string;
}

/** An alias as the resolver sees it: its text, its fold and its Ingredient. */
export interface IngredientAliasRow extends IngredientRef {
  text: string;
  fold: string;
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
 * already taken keeps pointing where it points, and the new Ingredient is
 * removed again with any spelling it did get joining the one that won. A name that is already an
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

    if (!minted) return rows;

    // Lost the race for a spelling: another request's Ingredient already holds
    // it, so the spellings this mint did get join that one, and one food stays
    // one Ingredient.
    const winner = rows.find((row) => row.ingredientId !== minted.id)?.ingredientId;

    if (!winner) return rows;

    await tx
      .update(ingredientAliases)
      .set({ ingredientId: winner })
      .where(eq(ingredientAliases.ingredientId, minted.id));
    await tx.delete(ingredients).where(eq(ingredients.id, minted.id));

    return rows.map((row) =>
      row.ingredientId === minted.id ? { ...row, ingredientId: winner } : row
    );
  });
}

/** Recipe lines' texts and the aliases they resolved to, by line id. */
export async function findRecipeLineAliases(
  recipeIngredientIds: readonly string[]
): Promise<Map<string, IngredientRef & { name: string }>> {
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
