import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DbTransaction } from "@norish/db/drizzle";
import type { IngredientSearch, IngredientSearchField } from "@norish/shared/lib/ingredient-search";
import { db } from "@norish/db/drizzle";
import {
  groceries,
  ingredientAliases,
  ingredients,
  ingredientSuggestions,
  pantryIngredients,
  recipeIngredients,
  recurringGroceries,
} from "@norish/db/schema";

/**
 * The catalogue of Ingredients as the Ingredients page reads and edits it
 * (ADR-0037): its rows, their spellings, and the edits that stay within one
 * Ingredient. What moves between Ingredients — a merge, an alias move, a
 * parent — is in `ingredient-relocation`. Nothing here decides who may edit
 * what: the ingredient module in `@norish/shared-server/ingredients` checks
 * the edit policy and calls these writers, as the resolver calls the minting
 * ones.
 */

/** One Ingredient as the page lists it, with every spelling it is known by. */
export interface CatalogueIngredient {
  id: string;
  name: string;
  flagged: boolean;
  flagReason: string | null;
  ownerId: string | null;
  version: number;
  parent: { id: string; name: string } | null;
  /** How many Ingredients are kinds of this one. */
  kinds: number;
  aliases: CatalogueAlias[];
}

export interface CatalogueAlias {
  id: string;
  text: string;
  ownerId: string | null;
  locale?: string | null;
  seeded?: boolean;
}

/** Who owns a row of the catalogue, which is what the edit policy is asked about. */
export interface CatalogueOwner {
  ownerId: string | null;
}

/**
 * One search against the fields it asks to look in: the Ingredient's name,
 * its translations, or its parent's name and translations. An exact search
 * compares the fold, a contains search runs the `LIKE` pattern. Names carry
 * no fold column, so a name is matched lowercased, which is the fold of an
 * ASCII name; an accented name is found through its own spelling.
 */
function matchingSearch(search: IngredientSearch, parents: { id: AnyPgColumn; name: AnyPgColumn }) {
  const matches = (value: SQL): SQL =>
    search.match === "exact"
      ? sql`${value} = ${search.fold}`
      : sql`${value} like ${search.pattern}`;
  const spellingOf = (ingredientId: SQL | typeof ingredients.id) =>
    sql`exists (select 1 from ${ingredientAliases} where ${ingredientAliases.ingredientId} = ${ingredientId} and ${matches(sql`${ingredientAliases.fold}`)})`;

  const byField: Record<IngredientSearchField, SQL> = {
    name: matches(sql`lower(${ingredients.name})`),
    translations: spellingOf(ingredients.id),
    parent: or(matches(sql`lower(${parents.name})`), spellingOf(sql`${parents.id}`)) ?? sql`false`,
  };

  return or(...search.fields.map((field) => byField[field]));
}

/**
 * A page of the catalogue: every Ingredient, or the flagged ones, or those a
 * search names (`parseIngredientSearch`) by their name or any spelling. An
 * Ingredient named exactly what was typed comes first; then the flagged,
 * since they are what wants looking at; then by name.
 */
export async function listCatalogueIngredients(query: {
  search: IngredientSearch | null;
  flaggedOnly: boolean;
  /** Only the Ingredients filed under this one (null: the ones filed under none); undefined for every one. */
  parentId?: string | null;
  /** Only the Ingredients filed under none that nothing is filed under: no parent, no kinds. */
  standaloneOnly?: boolean;
  /** Only this Ingredient, for a panel that follows one food a filter no longer lists. */
  id?: string;
  limit: number;
  offset: number;
}): Promise<CatalogueIngredient[]> {
  const parents = alias(ingredients, "parent");
  const matchesSearch = query.search ? matchingSearch(query.search, parents) : undefined;
  const exactFirst = query.search
    ? [sql`case when lower(${ingredients.name}) = ${query.search.fold} then 0 else 1 end`]
    : [];

  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      flagged: ingredients.flagged,
      flagReason: ingredients.flagReason,
      ownerId: ingredients.ownerId,
      version: ingredients.version,
      parentId: parents.id,
      parentName: parents.name,
      // The table under its own name again: a Drizzle alias in raw SQL renders bare.
      kinds: sql<number>`(select count(*)::int from ${ingredients} k where k.parent_id = ${ingredients.id})`,
    })
    .from(ingredients)
    .leftJoin(parents, eq(parents.id, ingredients.parentId))
    .where(
      and(
        query.id === undefined ? undefined : eq(ingredients.id, query.id),
        query.flaggedOnly ? eq(ingredients.flagged, true) : undefined,
        query.parentId === undefined
          ? undefined
          : query.parentId === null
            ? isNull(ingredients.parentId)
            : eq(ingredients.parentId, query.parentId),
        query.standaloneOnly
          ? and(
              isNull(ingredients.parentId),
              sql`not exists (select 1 from ${ingredients} k where k.parent_id = ${ingredients.id})`
            )
          : undefined,
        matchesSearch
      )
    )
    .orderBy(
      ...exactFirst,
      desc(ingredients.flagged),
      asc(sql`lower(${ingredients.name})`),
      asc(ingredients.id)
    )
    .limit(query.limit)
    .offset(query.offset);

  if (rows.length === 0) return [];

  const aliases = await db
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      ownerId: ingredientAliases.ownerId,
      locale: ingredientAliases.locale,
      seeded: ingredientAliases.seeded,
      ingredientId: ingredientAliases.ingredientId,
    })
    .from(ingredientAliases)
    .where(
      inArray(
        ingredientAliases.ingredientId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(ingredientAliases.createdAt), asc(ingredientAliases.id));

  return rows.map(({ parentId, parentName, ...row }) => ({
    ...row,
    parent: parentId && parentName ? { id: parentId, name: parentName } : null,
    aliases: aliases
      .filter((alias) => alias.ingredientId === row.id)
      .map(({ ingredientId: _ingredientId, ...alias }) => alias),
  }));
}

/** Every spelling of one Ingredient, in every language, oldest first. */
export async function listCatalogueAliasesOf(ingredientId: string): Promise<CatalogueAlias[]> {
  return await db
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      ownerId: ingredientAliases.ownerId,
      locale: ingredientAliases.locale,
      seeded: ingredientAliases.seeded,
    })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.ingredientId, ingredientId))
    .orderBy(asc(ingredientAliases.createdAt), asc(ingredientAliases.id));
}

/** One Ingredient as an edit reads it: its name, whether it is flagged, and whose it is. */
export async function findCatalogueIngredient(
  id: string
): Promise<(CatalogueOwner & { id: string; name: string; flagged: boolean }) | null> {
  const [row] = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      flagged: ingredients.flagged,
      ownerId: ingredients.ownerId,
    })
    .from(ingredients)
    .where(eq(ingredients.id, id))
    .limit(1);

  return row ?? null;
}

/** The names of these Ingredients, by id; an id the catalogue no longer holds is left out. */
export async function findCatalogueIngredientNames(
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

/**
 * A Flagged Ingredient as a round of Ask AI picks from them: whose it is, and
 * whether a suggestion waits on it.
 */
export interface FlaggedCatalogueIngredient extends CatalogueOwner {
  id: string;
  name: string;
  suggested: boolean;
}

/**
 * Every Flagged Ingredient, by name. Nothing here decides which the asker may
 * edit. An Ingredient has one suggestion at most, so the join adds no rows.
 */
export async function listFlaggedCatalogueIngredients(): Promise<FlaggedCatalogueIngredient[]> {
  return db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      ownerId: ingredients.ownerId,
      suggested: sql<boolean>`${ingredientSuggestions.id} is not null`,
    })
    .from(ingredients)
    .leftJoin(ingredientSuggestions, eq(ingredientSuggestions.ingredientId, ingredients.id))
    .where(eq(ingredients.flagged, true))
    .orderBy(asc(sql`lower(${ingredients.name})`), asc(ingredients.id));
}

/** Say anew why a Flagged Ingredient is one: AI was asked again and is still not sure. */
export async function setIngredientFlagReason(id: string, flagReason: string): Promise<void> {
  await db
    .update(ingredients)
    .set({ flagReason, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.id, id), eq(ingredients.flagged, true)));
}

export async function findCatalogueIngredientOwner(
  tx: DbTransaction,
  id: string
): Promise<CatalogueOwner | null> {
  const [row] = await tx
    .select({ ownerId: ingredients.ownerId })
    .from(ingredients)
    .where(eq(ingredients.id, id))
    .limit(1);

  return row ?? null;
}

export async function findCatalogueAliasOwner(
  tx: DbTransaction,
  aliasId: string
): Promise<(CatalogueOwner & { ingredientId: string; text: string }) | null> {
  const [row] = await tx
    .select({
      ownerId: ingredientAliases.ownerId,
      ingredientId: ingredientAliases.ingredientId,
      text: ingredientAliases.text,
    })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.id, aliasId))
    .limit(1);

  return row ?? null;
}

/**
 * Rename an Ingredient and clear its flag: looking after a flagged Ingredient
 * counts as reviewing it. Null where it is gone. The name is unique, so one
 * another Ingredient got first, even by a rename racing this one, throws a
 * unique violation.
 */
export async function renameCatalogueIngredient(
  tx: DbTransaction,
  id: string,
  name: string
): Promise<{ id: string } | null> {
  const [row] = await tx
    .update(ingredients)
    .set({ name, flagged: false, flagReason: null, version: sql`${ingredients.version} + 1` })
    .where(eq(ingredients.id, id))
    .returning({ id: ingredients.id });

  return row ?? null;
}

/**
 * Mark an Ingredient a food of its own: its flag goes, and Norish remembers
 * the person's decision so it never merges the Ingredient later. Null where
 * it is gone.
 */
export async function keepIngredientDistinct(
  tx: DbTransaction,
  id: string
): Promise<{ id: string } | null> {
  const [row] = await tx
    .update(ingredients)
    .set({
      flagged: false,
      flagReason: null,
      keptDistinct: true,
      version: sql`${ingredients.version} + 1`,
    })
    .where(eq(ingredients.id, id))
    .returning({ id: ingredients.id });

  return row ?? null;
}

/** The Ingredient a spelling already names, if any. */
export async function findIngredientIdByFold(
  tx: DbTransaction,
  fold: string
): Promise<string | null> {
  const [row] = await tx
    .select({ ingredientId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.fold, fold))
    .limit(1);

  return row?.ingredientId ?? null;
}

/**
 * Give an Ingredient a spelling a person added. The fold is unique, so a
 * spelling another Ingredient already holds is refused by the row itself:
 * null then, and the caller says which food holds it.
 */
export async function insertCatalogueAlias(
  tx: DbTransaction,
  input: { ingredientId: string; text: string; fold: string; ownerId: string }
): Promise<CatalogueAlias | null> {
  const [row] = await tx.insert(ingredientAliases).values(input).onConflictDoNothing().returning({
    id: ingredientAliases.id,
    text: ingredientAliases.text,
    ownerId: ingredientAliases.ownerId,
  });

  return row ?? null;
}

/** Whether a recipe line, grocery, recurring grocery or Pantry Ingredient points at a spelling. */
export async function isAliasInUse(tx: DbTransaction, aliasId: string): Promise<boolean> {
  const references = await Promise.all(
    [recipeIngredients, groceries, recurringGroceries, pantryIngredients].map((table) =>
      tx
        .select({ one: sql`1` })
        .from(table)
        .where(eq(table.ingredientAliasId, aliasId))
        .limit(1)
    )
  );

  return references.some((rows) => rows.length > 0);
}

/**
 * Remove a spelling. The caller holds its Ingredient and has kept it a
 * spelling and found nothing pointing at this one; something that came to
 * point at it since throws a foreign-key violation.
 */
export async function deleteCatalogueAlias(tx: DbTransaction, aliasId: string): Promise<void> {
  await tx.delete(ingredientAliases).where(eq(ingredientAliases.id, aliasId));
}

/**
 * Whether a recipe line, grocery, recurring grocery or Pantry Ingredient
 * points at an Ingredient, directly or through one of its spellings.
 */
export async function isIngredientInUse(tx: DbTransaction, id: string): Promise<boolean> {
  const references = await Promise.all(
    [recipeIngredients, groceries, recurringGroceries, pantryIngredients].map((table) =>
      tx
        .select({ one: sql`1` })
        .from(table)
        .innerJoin(ingredientAliases, eq(ingredientAliases.id, table.ingredientAliasId))
        .where(eq(ingredientAliases.ingredientId, id))
        .limit(1)
    )
  );
  const byIngredient = await Promise.all(
    [groceries, recurringGroceries, pantryIngredients].map((table) =>
      tx
        .select({ one: sql`1` })
        .from(table)
        .where(eq(table.ingredientId, id))
        .limit(1)
    )
  );

  return [...references, ...byIngredient].some((rows) => rows.length > 0);
}

/**
 * Delete an Ingredient, with every spelling it was known by and what the
 * household taught Norish about it (Product Links, Aisle Links, store
 * preferences). Its children become Ingredients of their own. The caller
 * holds the tree lock and the row and has found nothing using it; something
 * that came to point at one of its spellings since throws a foreign-key
 * violation.
 */
export async function deleteCatalogueIngredient(tx: DbTransaction, id: string): Promise<void> {
  await tx.delete(ingredients).where(eq(ingredients.id, id));
}
