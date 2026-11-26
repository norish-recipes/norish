import { and, asc, between, eq, exists, inArray, isNull, like, or, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { Db } from "@norish/db/drizzle";
import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { FoodName, LocaleNames } from "@norish/shared/lib/ingredient-names";
import { db } from "@norish/db/drizzle";
import {
  ingredientAliases,
  ingredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
} from "@norish/db/schema";
import { CATALOGUE_LANGUAGES, chooseLocaleNames } from "@norish/shared/lib/ingredient-names";
import { slipLengths } from "@norish/shared/lib/name-slips";

import type { LineResolution } from "./ingredients";
import { isAnyOf } from "./array-params";
import { isConstraintViolation } from "./constraint-violation";
import { inCatalogue, isInstanceRow, ownBeforeSeed } from "./household-scope";
import { ingredientIsListed } from "./ingredient-catalogue";
import { buildPolicyCondition } from "./recipes";

/**
 * The Ingredient Alias rows the resolver reads and writes; only the resolver
 * (`shared-server/ingredients`) calls the writers, the one path that mints (ADR-0037). Every read
 * is one household's catalogue, its own spellings before the seed's of the same fold (ADR-0042).
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

const qb = new QueryBuilder();
const parentRow = alias(ingredients, "p");

const aliasColumns = {
  aliasId: ingredientAliases.id,
  text: ingredientAliases.text,
  fold: ingredientAliases.fold,
  locale: ingredientAliases.locale,
  ingredientId: ingredientAliases.ingredientId,
};

/** How many folds one lookup carries: an upgrade batch reads every plural of every line. */
const FOLDS_PER_QUERY = 5000;

/** The household's (else the seed's) spelling of each fold. */
export async function findIngredientAliasesByFolds(
  householdId: string,
  folds: readonly string[],
  tx: Pick<Db, "selectDistinctOn"> = db
): Promise<IngredientAliasRow[]> {
  const unique = Array.from(new Set(folds.filter((fold) => fold.length > 0)));
  const rows: IngredientAliasRow[] = [];

  for (let start = 0; start < unique.length; start += FOLDS_PER_QUERY) {
    rows.push(
      ...(await tx
        .selectDistinctOn([ingredientAliases.fold], aliasColumns)
        .from(ingredientAliases)
        .where(
          and(
            inArray(ingredientAliases.fold, unique.slice(start, start + FOLDS_PER_QUERY)),
            inCatalogue(ingredientAliases.householdId, householdId)
          )
        )
        .orderBy(ingredientAliases.fold, ownBeforeSeed(ingredientAliases.householdId)))
    );
  }

  return rows;
}

/**
 * The household's and the seed's foods whose lowercased name is one of `names`, each with one of
 * its spellings there; the seed's first, so a reader keying by name keeps the household's.
 */
export async function findIngredientsNamed(
  householdId: string,
  names: readonly string[]
): Promise<Array<IngredientRef & { name: string }>> {
  const unique = [...new Set(names.filter((name) => name.length > 0))];

  if (unique.length === 0) return [];

  const rows = await db
    .selectDistinctOn([ingredients.id], {
      name: ingredients.name,
      ingredientId: ingredients.id,
      aliasId: ingredientAliases.id,
      seed: isInstanceRow(ingredients.householdId),
    })
    .from(ingredients)
    .innerJoin(ingredientAliases, eq(ingredientAliases.ingredientId, ingredients.id))
    .where(
      and(
        inArray(sql`lower(${ingredients.name})`, unique),
        inCatalogue(ingredients.householdId, householdId),
        inCatalogue(ingredientAliases.householdId, householdId)
      )
    )
    .orderBy(ingredients.id, asc(ingredientAliases.createdAt));

  return rows.sort((a, b) => Number(b.seed) - Number(a.seed)).map(({ seed: _seed, ...row }) => row);
}

/** A text a LIKE pattern matches as written: its wildcards and escapes escaped. */
export function likeLiteral(part: string): string {
  return part.replace(/[\\%_]/g, "\\$&");
}

/**
 * The spellings `fold` could be a slip of the fingers from (`@norish/shared/lib/name-slips`): of a
 * length a slip reaches, sharing its first or last letters, so one slip anywhere in it is found.
 */
export async function findAliasesNearFold(
  householdId: string,
  fold: string
): Promise<IngredientAliasRow[]> {
  const { min, max } = slipLengths(fold);
  const ends = Math.min(3, Math.floor((fold.length - 1) / 2));

  return await db
    .selectDistinctOn([ingredientAliases.fold], aliasColumns)
    .from(ingredientAliases)
    .where(
      and(
        inCatalogue(ingredientAliases.householdId, householdId),
        between(sql`length(${ingredientAliases.fold})`, min, max),
        or(
          like(ingredientAliases.fold, `${likeLiteral(fold.slice(0, ends))}%`),
          like(ingredientAliases.fold, `%${likeLiteral(fold.slice(-ends))}`)
        )
      )
    )
    .orderBy(ingredientAliases.fold, ownBeforeSeed(ingredientAliases.householdId));
}

/**
 * The seeded foods' spellings among these folds (the seed's, and any a seeded food gained by a
 * merge or a person), or the listed foods' (seeded, or a recipe line names it), which a mint's
 * last words may file it under.
 */
export async function findFoodSpellingsByFolds(
  householdId: string,
  folds: readonly string[],
  among: "seeded" | "listed"
): Promise<IngredientAliasRow[]> {
  const unique = Array.from(new Set(folds.filter((fold) => fold.length > 0)));

  if (unique.length === 0) return [];

  return await db
    .selectDistinctOn([ingredientAliases.fold], aliasColumns)
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(
      and(
        inArray(ingredientAliases.fold, unique),
        inCatalogue(ingredientAliases.householdId, householdId),
        among === "seeded" ? isNull(ingredients.householdId) : ingredientIsListed()
      )
    )
    .orderBy(ingredientAliases.fold, ownBeforeSeed(ingredientAliases.householdId));
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
  householdId: string | null,
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
        inCatalogue(ingredientAliases.householdId, householdId),
        inArray(ingredientAliases.locale, [...CATALOGUE_LANGUAGES])
      )
    );
  const byIngredient = new Map<string, typeof rows>();

  for (const row of rows) {
    byIngredient.set(row.ingredientId, [...(byIngredient.get(row.ingredientId) ?? []), row]);
  }

  return new Map(unique.map((id) => [id, chooseLocaleNames(byIngredient.get(id) ?? [])]));
}

/** The names of the household's and the seed's foods among `ids`; another household's are left out. */
export async function findIngredientNamesByIds(
  householdId: string,
  ids: readonly string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));

  if (unique.length === 0) return new Map();

  const rows = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(and(inArray(ingredients.id, unique), inCatalogue(ingredients.householdId, householdId)));

  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Each Ingredient's catalogue name and its best spelling per language, for a name in the reader's. */
export async function findIngredientDisplayNames(
  householdId: string,
  ids: readonly string[]
): Promise<Map<string, FoodName>> {
  const [names, localeNames] = await Promise.all([
    findIngredientNamesByIds(householdId, ids),
    findLocaleNames(householdId, ids),
  ]);

  return new Map(
    [...names].map(([id, name]) => [id, { name, localeNames: localeNames.get(id) ?? {} }])
  );
}

export interface MintIngredientInput {
  /** The household whose recipe, list or Pantry the text came from: the mint is its food. */
  householdId: string;
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
 * Mint an Ingredient in a household with its aliases, answering each fold's alias and whether a food
 * was created. A lost race or a name the household's or the seed's food has (any case) joins it; a
 * household's food with no spelling is taken over. A parent outside the catalogue is left out.
 */
export async function mintIngredientWithAliases(
  input: MintIngredientInput
): Promise<{ aliases: IngredientAliasRow[]; created: boolean }> {
  // A name another mint took meanwhile starts again, so its food is locked in order too.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const done = await mintOnce(input);

    if (done) return done;
  }
  throw new Error("Failed to mint or find ingredient");
}

async function mintOnce(
  input: MintIngredientInput
): Promise<{ aliases: IngredientAliasRow[]; created: boolean } | null> {
  const folds = input.aliases.map((alias) => alias.fold);
  const { householdId } = input;

  return await db.transaction(async (tx) => {
    const holderOf = async () =>
      (
        await tx
          .select({
            id: ingredients.id,
            seed: isInstanceRow(ingredients.householdId),
            spelled: exists(
              qb
                .select({ id: ingredientAliases.id })
                .from(ingredientAliases)
                .where(eq(ingredientAliases.ingredientId, ingredients.id))
            ).mapWith(Boolean),
          })
          .from(ingredients)
          .where(
            and(
              eq(sql`lower(${ingredients.name})`, sql`lower(${input.name})`),
              inCatalogue(ingredients.householdId, householdId)
            )
          )
          .orderBy(ownBeforeSeed(ingredients.householdId))
          .limit(1)
      ).at(0);
    // The parent still in the household's catalogue.
    const [parent] = input.parentId
      ? await tx
          .select({ id: parentRow.id })
          .from(parentRow)
          .where(
            and(eq(parentRow.id, input.parentId), inCatalogue(parentRow.householdId, householdId))
          )
      : [];
    const named = await holderOf();
    const toHold = [named?.id, parent?.id].filter((id) => id !== undefined);
    // Both held until the spellings are in, so a delete waits; in id order, as every edit locks foods.
    const held = new Set(
      toHold.length === 0
        ? []
        : (
            await tx
              .select({ id: ingredients.id })
              .from(ingredients)
              .where(isAnyOf(ingredients.id, toHold, "uuid"))
              .orderBy(asc(ingredients.id))
              .for("key share")
          ).map((row) => row.id)
    );
    const parentId = parent && held.has(parent.id) ? parent.id : null;
    // Read again under the lock: renamed or deleted meanwhile, it is no holder.
    const again = named && held.has(named.id) ? await holderOf() : undefined;
    const holder = again?.id === named?.id ? again : undefined;
    const [minted] = holder
      ? []
      : await tx
          .insert(ingredients)
          .values({
            householdId,
            name: input.name,
            ownerId: input.ownerId,
            flagged: input.flagged,
            flagReason: input.flagged ? (input.flagReason ?? null) : null,
            parentId,
          })
          .onConflictDoNothing()
          .returning({ id: ingredients.id });

    if (!minted && !holder) return null;
    const ingredientId = minted?.id ?? holder?.id;

    if (!ingredientId) throw new Error("Failed to mint or find ingredient");

    // A seeded food is the admins': a mint joins it as a spelling and changes nothing else.
    const takenOver = holder !== undefined && !holder.spelled && !holder.seed;

    if (takenOver) {
      await tx
        .update(ingredients)
        .set({
          name: input.name,
          ownerId: sql`coalesce(${ingredients.ownerId}, ${input.ownerId})`,
          flagged: input.flagged,
          flagReason: input.flagged ? (input.flagReason ?? null) : null,
          parentId,
          version: sql`${ingredients.version} + 1`,
        })
        .where(eq(ingredients.id, ingredientId));
    }

    await tx
      .insert(ingredientAliases)
      .values(
        input.aliases.map((alias) => ({
          householdId,
          text: alias.text,
          fold: alias.fold,
          locale: input.locale,
          ingredientId,
          ownerId: input.ownerId,
        }))
      )
      .onConflictDoNothing();

    // Each fold's alias, in the order the aliases were given.
    const rows = (await findIngredientAliasesByFolds(householdId, folds, tx)).sort(
      (a, b) => folds.indexOf(a.fold) - folds.indexOf(b.fold)
    );

    if (!minted) return { aliases: rows, created: false };

    // Lost the race for a spelling: what this mint got joins the Ingredient holding it, so one food
    // stays one Ingredient.
    const winner = rows.find((row) => row.ingredientId !== minted.id)?.ingredientId;

    if (!winner) return { aliases: rows, created: true };

    await tx
      .update(ingredientAliases)
      .set({ ingredientId: winner })
      .where(eq(ingredientAliases.ingredientId, minted.id));
    await tx.delete(ingredients).where(eq(ingredients.id, minted.id));

    return {
      aliases: rows.map((row) =>
        row.ingredientId === minted.id ? { ...row, ingredientId: winner } : row
      ),
      created: false,
    };
  });
}

/**
 * Add the household's spellings to its or a seeded Ingredient, answering each fold's alias; a fold
 * the household's catalogue holds stays there. Null where the Ingredient was merged away.
 */
export async function addIngredientAliases(input: {
  householdId: string;
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
          householdId: input.householdId,
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

  return await findIngredientAliasesByFolds(
    input.householdId,
    input.aliases.map((alias) => alias.fold)
  );
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
  householdId: string,
  ids: readonly string[]
): Promise<IngredientCandidate[]> {
  if (ids.length === 0) return [];

  const parents = alias(ingredients, "parent");
  const candidates = await candidatesFor(
    householdId,
    await db
      .select({ id: ingredients.id, name: ingredients.name, parent: parents.name })
      .from(ingredients)
      .leftJoin(parents, eq(parents.id, ingredients.parentId))
      .where(
        and(inArray(ingredients.id, [...ids]), inCatalogue(ingredients.householdId, householdId))
      )
  );

  return candidates.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

/** Candidate rows for known Ingredients: each with its shortest other names. */
async function candidatesFor(
  householdId: string,
  rows: ReadonlyArray<{ id: string; name: string; parent: string | null }>
): Promise<IngredientCandidate[]> {
  if (rows.length === 0) return [];

  const spellings = await db
    .select({ ingredientId: ingredientAliases.ingredientId, text: ingredientAliases.text })
    .from(ingredientAliases)
    .where(
      and(
        inArray(
          ingredientAliases.ingredientId,
          rows.map((row) => row.id)
        ),
        inCatalogue(ingredientAliases.householdId, householdId)
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

/**
 * Recipe lines' texts and the foods they resolved to, by line id; a line naming no food has none.
 * Asked for a reader's household, a line of a recipe it may not view is as missing; null, any line.
 */
export async function findRecipeLineAliases(
  recipeIngredientIds: readonly string[],
  readerHouseholdId: string | null
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
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .where(
      and(
        inArray(recipeIngredients.id, unique),
        readerHouseholdId === null
          ? undefined
          : await buildPolicyCondition(
              { householdId: readerHouseholdId },
              recipes.householdId,
              "view"
            )
      )
    )
    .orderBy(asc(recipeIngredientFoods.position));
  const lines = new Map<string, RecipeLineAlias>();

  for (const { id, aliasId, ingredientId, ...line } of rows) {
    const found = lines.get(id) ?? { ...line, foods: [] };

    if (aliasId && ingredientId) found.foods.push({ aliasId, ingredientId });
    lines.set(id, found);
  }

  return lines;
}
