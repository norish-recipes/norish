import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { db } from "@norish/db/drizzle";
import { ingredientAliases, ingredients, recipeIngredients } from "@norish/db/schema";
import { CATALOGUE_LANGUAGES, chooseLocaleNames } from "@norish/shared/lib/ingredient-names";

import { isConstraintViolation } from "./constraint-violation";

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
  flagReason: string | null;
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

    const ingredientId =
      minted?.id ??
      (
        await tx
          .select({ id: ingredients.id })
          .from(ingredients)
          .where(eq(sql`lower(${ingredients.name})`, sql`lower(${input.name})`))
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

/**
 * Add spellings to an Ingredient that already exists, and answer with the
 * alias each requested fold now has. A fold another Ingredient already holds
 * keeps pointing where it points: one spelling means one food. Null where
 * the Ingredient is gone — merged away since it was read.
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
  aliases: string[];
}

/** How many alias rows one candidate search reads per word start. */
const ROWS_PER_START = 100;

/**
 * The Ingredients with an alias that has a word beginning with one of the
 * given word starts: those sharing the most starts first, then taking turns
 * across the starts, so a common word ("red" in "red onions") filling the
 * catalogue cannot crowd out the one the name is about ("onio"). Each start
 * reads its shortest spellings first, so the plain food leads its variants.
 * The starts are the first letters of a name's words, so "onions" finds
 * "onion" and "tomatoes" finds "tomato"; which of them the name really is, is
 * not decided here.
 */
export async function findIngredientCandidates(
  wordStarts: readonly string[],
  limit: number,
  /** An Ingredient never offered as a candidate: the one the question is about. */
  excludeId: string | null = null
): Promise<IngredientCandidate[]> {
  const starts = Array.from(new Set(wordStarts.filter((start) => start.length > 0)));

  if (starts.length === 0) return [];

  const perStart = await Promise.all(
    starts.map((start) =>
      db
        .select({
          id: ingredients.id,
          name: ingredients.name,
          text: ingredientAliases.text,
          fold: ingredientAliases.fold,
        })
        .from(ingredientAliases)
        .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
        .where(
          and(
            sql`(' ' || ${ingredientAliases.fold}) like ${`% ${start}%`}`,
            excludeId ? ne(ingredients.id, excludeId) : undefined
          )
        )
        .orderBy(asc(sql`length(${ingredientAliases.fold})`), asc(ingredientAliases.id))
        .limit(ROWS_PER_START)
    )
  );

  const candidates = new Map<string, IngredientCandidate>();
  const shared = new Map<string, Set<number>>();
  const turns: string[][] = perStart.map(() => []);

  perStart.forEach((rows, startIndex) => {
    for (const row of rows) {
      const candidate = candidates.get(row.id) ?? { id: row.id, name: row.name, aliases: [] };

      if (row.text !== row.name && !candidate.aliases.includes(row.text)) {
        candidate.aliases.push(row.text);
      }
      candidates.set(row.id, candidate);

      const starts = shared.get(row.id) ?? new Set<number>();

      if (!starts.has(startIndex)) turns[startIndex]!.push(row.id);
      starts.add(startIndex);
      shared.set(row.id, starts);
    }
  });

  // Round-robin across the starts, each in its own order.
  const order: string[] = [];

  for (let turn = 0; order.length < candidates.size; turn += 1) {
    for (const ids of turns) {
      const id = ids[turn];

      if (id && !order.includes(id)) order.push(id);
    }
  }

  return order
    .map((id, position) => ({ id, position, shares: shared.get(id)!.size }))
    .sort((a, b) => b.shares - a.shares || a.position - b.position)
    .slice(0, limit)
    .map(({ id }) => candidates.get(id)!);
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
