import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import { db } from "@norish/db/drizzle";
import {
  groceries,
  ingredientAliases,
  ingredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
  recurringGroceries,
} from "@norish/db/schema";

import {
  findGroceryRows,
  ingredientIsListed,
  nameIsFree,
  rowsNaming,
} from "./ingredient-catalogue";
import { writeRecipeLineFoodsTx } from "./ingredients";

/**
 * The first-start cleanup's reads and writes (ADR-0037): spellings cleaned in place, and the rows
 * a removed spelling or a deleted food named pointed at what their own text resolves to.
 */

/** One spelling as the cleanup reads it. */
export interface CleanupSpelling {
  id: string;
  text: string;
  fold: string;
  seeded: boolean;
  ingredientId: string;
  /** Its food is an own one whose parent no person chose: the cleanup may merge it away. */
  cleanable: boolean;
}

/** Every spelling, oldest first, so the oldest of several with one clean name keeps it. */
export async function listSpellingsForCleanup(): Promise<CleanupSpelling[]> {
  return await db
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      fold: ingredientAliases.fold,
      seeded: ingredientAliases.seeded,
      ingredientId: ingredientAliases.ingredientId,
      cleanable: sql<boolean>`(${and(
        isNull(ingredients.offId),
        eq(ingredients.parentChosen, false)
      )})`,
    })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .orderBy(asc(ingredientAliases.createdAt), asc(ingredientAliases.id));
}

/** Give a spelling another text and fold, where no other spelling has the fold; whether it did. */
export async function rewriteSpelling(
  id: string,
  { text, fold }: { text: string; fold: string }
): Promise<boolean> {
  const others = db
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(and(eq(ingredientAliases.fold, fold), ne(ingredientAliases.id, id)));
  const rewritten = await db
    .update(ingredientAliases)
    .set({ text, fold, version: sql`${ingredientAliases.version} + 1`, updatedAt: new Date() })
    .where(and(eq(ingredientAliases.id, id), sql`not exists (${others})`))
    .returning({ id: ingredientAliases.id });

  return rewritten.length > 0;
}

/** A row a spelling named, with its own text and whose it is. */
export interface NamingRow {
  id: string;
  name: string | null;
  ownerId: string | null;
}

/** The rows that name something: the recipe lines, Groceries and recurring groceries. */
export interface NamingRows {
  lines: Array<NamingRow & { amount: string | null; unit: string | null }>;
  groceries: NamingRow[];
  recurring: NamingRow[];
}

/** The recipe lines, Groceries and recurring groceries naming any of these spellings. */
export async function findRowsNamingSpellings(
  tx: DbTransaction,
  aliasIds: readonly string[]
): Promise<NamingRows> {
  if (aliasIds.length === 0) return { lines: [], groceries: [], recurring: [] };

  return await findNamingRows(tx, {
    lineFoods: inArray(recipeIngredientFoods.ingredientAliasId, [...aliasIds]),
    groceries: inArray(groceries.ingredientAliasId, [...aliasIds]),
    recurringGroceries: inArray(recurringGroceries.ingredientAliasId, [...aliasIds]),
  });
}

/** The recipe lines, Groceries and recurring groceries naming a food (`rowsNaming`). */
export async function findRowsNamingFood(
  tx: DbTransaction,
  ingredientId: string
): Promise<NamingRows> {
  return await findNamingRows(tx, rowsNaming(ingredientId));
}

async function findNamingRows(
  tx: DbTransaction,
  where: {
    lineFoods: SQL | undefined;
    groceries: SQL | undefined;
    recurringGroceries: SQL | undefined;
  }
): Promise<NamingRows> {
  const lines = await findLines(tx, where.lineFoods);
  const named = await findGroceryRows(tx, {
    groceries: where.groceries,
    recurring: where.recurringGroceries,
  });

  return { lines, ...named };
}

/** Every recipe line naming a food, so the cleanup can read each line's own text again. */
export async function findLinesNamingAFood(): Promise<NamingRows["lines"]> {
  return await findLines(db, undefined);
}

async function findLines(tx: Db, lineFoods: SQL | undefined): Promise<NamingRows["lines"]> {
  return await tx
    .selectDistinct({
      id: recipeIngredients.id,
      name: recipeIngredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      ownerId: recipes.userId,
    })
    .from(recipeIngredientFoods)
    .innerJoin(
      recipeIngredients,
      eq(recipeIngredients.id, recipeIngredientFoods.recipeIngredientId)
    )
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .where(lineFoods);
}

/** Point recipe lines at the foods their text resolved to, over the ones they had. */
export async function repointLines(
  tx: DbTransaction,
  lines: ReadonlyArray<{ id: string; aliasIds: readonly string[]; joined: LineJoin | null }>
): Promise<void> {
  await writeRecipeLineFoodsTx(tx, lines);
  for (const line of lines) {
    await tx
      .update(recipeIngredients)
      .set({ joined: line.joined, version: sql`${recipeIngredients.version} + 1` })
      .where(eq(recipeIngredients.id, line.id));
  }
}

/** Every listed own Ingredient (no taxonomy entry, a recipe line names it), oldest first. */
export async function listOwnFoods(): Promise<Array<{ id: string; name: string }>> {
  return await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(and(isNull(ingredients.offId), ingredientIsListed()))
    .orderBy(asc(ingredients.createdAt), asc(ingredients.id));
}

/** Rename an own food to the clean name its name reduces to, unless a person named it or the name is taken. */
export async function renameFood(id: string, name: string): Promise<boolean> {
  const renamed = await db
    .update(ingredients)
    .set({ name, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.id, id), eq(ingredients.nameChosen, false), nameIsFree(id, name)))
    .returning({ id: ingredients.id });

  return renamed.length > 0;
}
