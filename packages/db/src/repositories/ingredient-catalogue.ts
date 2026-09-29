import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { IngredientSearch } from "@norish/shared/lib/ingredient-search";
import { db } from "@norish/db/drizzle";
import {
  groceries,
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredients,
  recurringGroceries,
} from "@norish/db/schema";

import { isConstraintViolation } from "./constraint-violation";
import { lockIngredients, lockTree } from "./ingredient-relocation";

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
 * The folded name and the spellings of an Ingredient against one search:
 * exactly that fold, or any of the `LIKE` patterns. Names carry no fold
 * column, so the name is matched lowercased, which is the fold of an ASCII
 * name; an accented name is found through its own spelling.
 */
function matchingSearch(search: IngredientSearch) {
  const name = sql`lower(${ingredients.name})`;
  const spelling = (test: (column: typeof ingredientAliases.fold) => SQL | undefined) =>
    sql`exists (select 1 from ${ingredientAliases} where ${ingredientAliases.ingredientId} = ${ingredients.id} and ${test(ingredientAliases.fold)})`;

  if (search.kind === "exact") {
    return or(
      sql`${name} = ${search.fold}`,
      spelling((fold) => eq(fold, search.fold))
    );
  }

  return or(
    ...search.patterns.map((pattern) => sql`${name} like ${pattern}`),
    spelling((fold) => or(...search.patterns.map((pattern) => sql`${fold} like ${pattern}`)))
  );
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
  limit: number;
  offset: number;
}): Promise<CatalogueIngredient[]> {
  const matchesSearch = query.search ? matchingSearch(query.search) : undefined;
  const typed = query.search?.kind === "like" ? query.search.patterns[0]?.replace(/%/g, "") : null;
  const exactFirst = typed
    ? [sql`case when lower(${ingredients.name}) = ${typed} then 0 else 1 end`]
    : [];

  const parents = alias(ingredients, "parent");
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
    })
    .from(ingredients)
    .leftJoin(parents, eq(parents.id, ingredients.parentId))
    .where(and(query.flaggedOnly ? eq(ingredients.flagged, true) : undefined, matchesSearch))
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

/** Say anew why a Flagged Ingredient is one: AI was asked again and is still not sure. */
export async function setIngredientFlagReason(id: string, flagReason: string): Promise<void> {
  await db
    .update(ingredients)
    .set({ flagReason, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.id, id), eq(ingredients.flagged, true)));
}

export async function findCatalogueIngredientOwner(id: string): Promise<CatalogueOwner | null> {
  const [row] = await db
    .select({ ownerId: ingredients.ownerId })
    .from(ingredients)
    .where(eq(ingredients.id, id))
    .limit(1);

  return row ?? null;
}

export async function findCatalogueAliasOwner(
  aliasId: string
): Promise<(CatalogueOwner & { ingredientId: string; text: string }) | null> {
  const [row] = await db
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
 * counts as reviewing it. `taken` where another Ingredient got the name first,
 * which the unique name holds even against a rename racing this one.
 */
export async function renameCatalogueIngredient(
  id: string,
  name: string
): Promise<"renamed" | "missing" | "taken"> {
  try {
    const [row] = await db
      .update(ingredients)
      .set({ name, flagged: false, flagReason: null, version: sql`${ingredients.version} + 1` })
      .where(eq(ingredients.id, id))
      .returning({ id: ingredients.id });

    return row ? "renamed" : "missing";
  } catch (error) {
    if (isConstraintViolation(error, "23505")) return "taken";
    throw error;
  }
}

/** Clear an Ingredient's flag: Norish's doubt about it was unfounded. */
export async function clearIngredientFlag(id: string): Promise<{ id: string } | null> {
  const [row] = await db
    .update(ingredients)
    .set({ flagged: false, flagReason: null, version: sql`${ingredients.version} + 1` })
    .where(eq(ingredients.id, id))
    .returning({ id: ingredients.id });

  return row ?? null;
}

/** The Ingredient a spelling already names, if any. */
export async function findIngredientIdByFold(fold: string): Promise<string | null> {
  const [row] = await db
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
export async function insertCatalogueAlias(input: {
  ingredientId: string;
  text: string;
  fold: string;
  ownerId: string;
}): Promise<CatalogueAlias | null> {
  const [row] = await db.insert(ingredientAliases).values(input).onConflictDoNothing().returning({
    id: ingredientAliases.id,
    text: ingredientAliases.text,
    ownerId: ingredientAliases.ownerId,
  });

  return row ?? null;
}

/**
 * Remove a spelling, where that loses nothing: an Ingredient keeps at least
 * one alias, and a spelling a recipe line, grocery or Pantry Ingredient
 * points at stays until it is moved (the reference would otherwise lose its
 * food). Answers what happened.
 */
export async function deleteCatalogueAlias(
  aliasId: string
): Promise<"deleted" | "last" | "in-use" | "missing"> {
  try {
    return await deleteAliasIfSpare(aliasId);
  } catch (error) {
    // Something came to point at it between the check and the delete.
    if (isConstraintViolation(error, "23503")) return "in-use";
    throw error;
  }
}

async function deleteAliasIfSpare(
  aliasId: string
): Promise<"deleted" | "last" | "in-use" | "missing"> {
  return await db.transaction(async (tx) => {
    const [alias] = await tx
      .select({ ingredientId: ingredientAliases.ingredientId })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.id, aliasId));

    if (!alias) return "missing";

    // The Ingredient is locked, not only the alias: two members removing its
    // last two spellings at once must not both find a sibling left.
    const [held] = await tx
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.id, alias.ingredientId))
      .for("update");

    if (!held) return "missing";

    const [{ value: siblings } = { value: 0 }] = await tx
      .select({ value: count() })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.ingredientId, alias.ingredientId));

    if (siblings <= 1) return "last";

    const references = await Promise.all(
      [recipeIngredients, groceries, recurringGroceries, pantryIngredients].map((table) =>
        tx
          .select({ one: sql`1` })
          .from(table)
          .where(eq(table.ingredientAliasId, aliasId))
          .limit(1)
      )
    );
    const used = references.some((rows) => rows.length > 0);

    if (used) return "in-use";

    await tx.delete(ingredientAliases).where(eq(ingredientAliases.id, aliasId));

    return "deleted";
  });
}

/**
 * Delete an Ingredient nothing uses, with every spelling it was known by and
 * what the household taught Norish about it (Product Links, Aisle Links,
 * store preferences). One a recipe line, grocery, recurring grocery or Pantry
 * Ingredient still points at stays: those would lose their food, and a merge
 * is the edit that gives them another. Its children become Ingredients of
 * their own.
 */
export async function deleteCatalogueIngredient(
  id: string
): Promise<"deleted" | "missing" | "in-use"> {
  try {
    return await db.transaction(async (tx) => {
      // The tree lock, as for every edit that changes what a row points at:
      // a merge into this Ingredient must not land while it goes.
      await lockTree(tx);
      if ((await lockIngredients(tx, [id])) < 1) return "missing";

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

      if ([...references, ...byIngredient].some((rows) => rows.length > 0)) return "in-use";

      await tx.delete(ingredients).where(eq(ingredients.id, id));

      return "deleted";
    });
  } catch (error) {
    // Something came to point at one of its spellings between the check and the delete.
    if (isConstraintViolation(error, "23503")) return "in-use";
    throw error;
  }
}
