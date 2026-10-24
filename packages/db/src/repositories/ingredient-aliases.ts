import { and, asc, between, eq, inArray, isNotNull, like, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { db } from "@norish/db/drizzle";
import {
  ingredientAliases,
  ingredients,
  recipeIngredientFoods,
  recipeIngredients,
} from "@norish/db/schema";
import { CATALOGUE_LANGUAGES, chooseLocaleNames } from "@norish/shared/lib/ingredient-names";
import { slipLengths } from "@norish/shared/lib/name-slips";

import type { LineResolution } from "./ingredients";
import { isConstraintViolation } from "./constraint-violation";

/**
 * The Ingredient Alias rows the resolver reads and writes; only the resolver
 * (`shared-server/ingredients`) calls the writers, the one path that mints (ADR-0037).
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
  /** The language the spelling is in, where known: a hint, never a rule. */
  locale: string | null;
}

/** An Ingredient as a reader of the catalogue sees it. */
export interface IngredientRow {
  id: string;
  name: string;
  ownerId: string | null;
  flagged: boolean;
  flagReason: string | null;
}

const aliasColumns = {
  aliasId: ingredientAliases.id,
  text: ingredientAliases.text,
  fold: ingredientAliases.fold,
  locale: ingredientAliases.locale,
  ingredientId: ingredientAliases.ingredientId,
};

/** How many folds one lookup carries: an upgrade batch reads every plural of every line. */
const FOLDS_PER_QUERY = 5000;

export async function findIngredientAliasesByFolds(
  folds: readonly string[]
): Promise<IngredientAliasRow[]> {
  const unique = Array.from(new Set(folds.filter((fold) => fold.length > 0)));
  const rows: IngredientAliasRow[] = [];

  for (let start = 0; start < unique.length; start += FOLDS_PER_QUERY) {
    rows.push(
      ...(await db
        .select(aliasColumns)
        .from(ingredientAliases)
        .where(inArray(ingredientAliases.fold, unique.slice(start, start + FOLDS_PER_QUERY))))
    );
  }

  return rows;
}

/** The foods whose lowercased name is one of `names`, each with one of its spellings. */
export async function findIngredientsNamed(
  names: readonly string[]
): Promise<Array<IngredientRef & { name: string }>> {
  const unique = [...new Set(names.filter((name) => name.length > 0))];

  if (unique.length === 0) return [];

  return await db
    .selectDistinctOn([ingredients.id], {
      name: ingredients.name,
      ingredientId: ingredients.id,
      aliasId: ingredientAliases.id,
    })
    .from(ingredients)
    .innerJoin(ingredientAliases, eq(ingredientAliases.ingredientId, ingredients.id))
    .where(inArray(sql`lower(${ingredients.name})`, unique))
    .orderBy(ingredients.id, asc(ingredientAliases.createdAt));
}

/**
 * The spellings `fold` could be a slip of the fingers from (`@norish/shared/lib/name-slips`): of a
 * length a slip reaches, sharing its first or last letters, so one slip anywhere in it is found.
 */
export async function findAliasesNearFold(fold: string): Promise<IngredientAliasRow[]> {
  const { min, max } = slipLengths(fold);
  const ends = Math.min(3, Math.floor((fold.length - 1) / 2));
  const literal = (part: string) => part.replace(/[\\%_]/g, "\\$&");

  return await db
    .select(aliasColumns)
    .from(ingredientAliases)
    .where(
      and(
        between(sql`length(${ingredientAliases.fold})`, min, max),
        or(
          like(ingredientAliases.fold, `${literal(fold.slice(0, ends))}%`),
          like(ingredientAliases.fold, `%${literal(fold.slice(-ends))}`)
        )
      )
    );
}

/**
 * The seeded foods' spellings among these folds (the seed's, and any a seeded food gained by a
 * merge or a person), which a mint's last words may file it under.
 */
export async function findSeededFoodSpellingsByFolds(
  folds: readonly string[]
): Promise<IngredientAliasRow[]> {
  const unique = Array.from(new Set(folds.filter((fold) => fold.length > 0)));

  if (unique.length === 0) return [];

  return await db
    .select(aliasColumns)
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(and(inArray(ingredientAliases.fold, unique), isNotNull(ingredients.offId)));
}

export async function findIngredientByAliasId(aliasId: string): Promise<IngredientRow | null> {
  const [row] = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      ownerId: ingredients.ownerId,
      flagged: ingredients.flagged,
      flagReason: ingredients.flagReason,
    })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredientAliases.ingredientId, ingredients.id))
    .where(eq(ingredientAliases.id, aliasId))
    .limit(1);

  return row ?? null;
}

/**
 * Each Ingredient's best spelling in every language a Norish locale reads,
 * for surfaces that show the Ingredient in the viewer's language.
 */
export async function findLocaleNames(
  ingredientIds: readonly string[],
  tx: Pick<typeof db, "select"> = db
): Promise<Map<string, LocaleNames>> {
  const unique = Array.from(new Set(ingredientIds));

  if (unique.length === 0) return new Map();

  const rows = await tx
    .select({
      ingredientId: ingredientAliases.ingredientId,
      text: ingredientAliases.text,
      locale: ingredientAliases.locale,
      seeded: ingredientAliases.seeded,
    })
    .from(ingredientAliases)
    .where(
      and(
        inArray(ingredientAliases.ingredientId, unique),
        inArray(ingredientAliases.locale, [...CATALOGUE_LANGUAGES])
      )
    );
  const byIngredient = new Map<string, typeof rows>();

  for (const row of rows) {
    byIngredient.set(row.ingredientId, [...(byIngredient.get(row.ingredientId) ?? []), row]);
  }

  return new Map(unique.map((id) => [id, chooseLocaleNames(byIngredient.get(id) ?? [])]));
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
  /** Why it is flagged, where it is. */
  flagReason?: FlagReason | null;
  /** The Parent Ingredient, where the food is a kind of a known one; none where that one is gone. */
  parentId?: string | null;
}

/**
 * Mint an Ingredient with its aliases, answering each fold's alias. A lost race or a name an
 * Ingredient has (any case) joins it, unless it has no spelling: the mint takes that over.
 */
export async function mintIngredientWithAliases(
  input: MintIngredientInput
): Promise<IngredientAliasRow[]> {
  try {
    return await mintOnce(input);
  } catch (error) {
    // The parent was merged away between the read and the insert: mint without it.
    if (input.parentId && isConstraintViolation(error, "23503")) {
      return await mintOnce({ ...input, parentId: null });
    }
    throw error;
  }
}

async function mintOnce(input: MintIngredientInput): Promise<IngredientAliasRow[]> {
  const folds = input.aliases.map((alias) => alias.fold);

  return await db.transaction(async (tx) => {
    const [minted] = await tx
      .insert(ingredients)
      .values({
        name: input.name,
        ownerId: input.ownerId,
        flagged: input.flagged,
        flagReason: input.flagged ? (input.flagReason ?? null) : null,
        parentId: input.parentId
          ? sql`(select ${ingredients.id} from ${ingredients} where ${ingredients.id} = ${input.parentId})`
          : null,
      })
      .onConflictDoNothing()
      .returning({ id: ingredients.id });

    const [holder] = minted
      ? []
      : await tx
          .select({
            id: ingredients.id,
            // Qualified by hand: a bare column here would bind to the subquery's own `id`.
            spelled: sql<boolean>`exists (select 1 from ${ingredientAliases} a where a.ingredient_id = ${ingredients}.id)`,
          })
          .from(ingredients)
          .where(eq(sql`lower(${ingredients.name})`, sql`lower(${input.name})`))
          .limit(1);
    const ingredientId = minted?.id ?? holder?.id;

    if (!ingredientId) throw new Error("Failed to mint or find ingredient");

    const takenOver = holder !== undefined && !holder.spelled;

    if (takenOver) {
      await tx
        .update(ingredients)
        .set({
          name: input.name,
          ownerId: sql`coalesce(${ingredients.ownerId}, ${input.ownerId})`,
          flagged: input.flagged,
          flagReason: input.flagged ? (input.flagReason ?? null) : null,
          parentId: input.parentId
            ? sql`(select p.id from ${ingredients} p where p.id = ${input.parentId})`
            : null,
          version: sql`${ingredients.version} + 1`,
        })
        .where(eq(ingredients.id, ingredientId));
    }

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

    // Lost the race for a spelling: what this mint got joins the Ingredient holding it, so one food
    // stays one Ingredient.
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

/**
 * Add spellings to an existing Ingredient, answering each fold's alias; a fold another Ingredient
 * holds stays there. Null where the Ingredient was merged away.
 */
export async function addIngredientAliases(input: {
  ingredientId: string;
  aliases: ReadonlyArray<{ text: string; fold: string }>;
  ownerId: string | null;
  locale: string | null;
}): Promise<IngredientAliasRow[] | null> {
  try {
    await db
      .insert(ingredientAliases)
      .values(
        input.aliases.map((alias) => ({
          text: alias.text,
          fold: alias.fold,
          locale: input.locale,
          ingredientId: input.ingredientId,
          ownerId: input.ownerId,
        }))
      )
      .onConflictDoNothing();
  } catch (error) {
    if (isConstraintViolation(error, "23503")) return null;
    throw error;
  }

  return await findIngredientAliasesByFolds(input.aliases.map((alias) => alias.fold));
}

/** An Ingredient a new name might be, with some of the names it is known by. */
export interface IngredientCandidate {
  id: string;
  name: string;
  /** The name of the food it is filed under, if any. */
  parent: string | null;
  aliases: string[];
}

/** These Ingredients as candidates for a question, in order, each with its parent and shortest other names. */
export async function findIngredientCandidatesByIds(
  ids: readonly string[]
): Promise<IngredientCandidate[]> {
  if (ids.length === 0) return [];

  const parents = alias(ingredients, "parent");
  const candidates = await candidatesFor(
    await db
      .select({ id: ingredients.id, name: ingredients.name, parent: parents.name })
      .from(ingredients)
      .leftJoin(parents, eq(parents.id, ingredients.parentId))
      .where(inArray(ingredients.id, [...ids]))
  );

  return candidates.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

/** Candidate rows for known Ingredients: each with its shortest other names. */
async function candidatesFor(
  rows: ReadonlyArray<{ id: string; name: string; parent: string | null }>
): Promise<IngredientCandidate[]> {
  if (rows.length === 0) return [];

  const spellings = await db
    .select({ ingredientId: ingredientAliases.ingredientId, text: ingredientAliases.text })
    .from(ingredientAliases)
    .where(
      inArray(
        ingredientAliases.ingredientId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(sql`length(${ingredientAliases.fold})`), asc(ingredientAliases.id));
  const byId = new Map(rows.map((row) => [row.id, { ...row, aliases: [] as string[] }]));

  for (const spelling of spellings) {
    const candidate = byId.get(spelling.ingredientId);

    if (
      candidate &&
      spelling.text !== candidate.name &&
      !candidate.aliases.includes(spelling.text)
    ) {
      candidate.aliases.push(spelling.text);
    }
  }

  return [...byId.values()];
}

/** A stored recipe line as it was resolved: its text, amount and unit, and its foods in order. */
export interface RecipeLineAlias extends LineResolution {
  recipeId: string;
  name: string;
  amount: string | null;
  unit: string | null;
  foods: IngredientRef[];
}

/** Recipe lines' texts and the foods they resolved to, by line id; a line naming no food has none. */
export async function findRecipeLineAliases(
  recipeIngredientIds: readonly string[]
): Promise<Map<string, RecipeLineAlias>> {
  const unique = Array.from(new Set(recipeIngredientIds));

  if (unique.length === 0) return new Map();

  const rows = await db
    .select({
      id: recipeIngredients.id,
      recipeId: recipeIngredients.recipeId,
      name: recipeIngredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      joined: recipeIngredients.joined,
      aliasId: ingredientAliases.id,
      ingredientId: ingredientAliases.ingredientId,
    })
    .from(recipeIngredients)
    .leftJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
    )
    .leftJoin(ingredientAliases, eq(recipeIngredientFoods.ingredientAliasId, ingredientAliases.id))
    .where(inArray(recipeIngredients.id, unique))
    .orderBy(asc(recipeIngredientFoods.position));
  const lines = new Map<string, RecipeLineAlias>();

  for (const { id, aliasId, ingredientId, ...line } of rows) {
    const found = lines.get(id) ?? { ...line, foods: [] };

    if (aliasId && ingredientId) found.foods.push({ aliasId, ingredientId });
    lines.set(id, found);
  }

  return lines;
}
