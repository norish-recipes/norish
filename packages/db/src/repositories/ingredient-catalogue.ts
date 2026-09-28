import { and, asc, count, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import {
  groceries,
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredients,
  recurringGroceries,
} from "@norish/db/schema";

/**
 * The catalogue of Ingredients as the Ingredients page reads and edits it
 * (ADR-0037). Nothing here decides who may edit what: the ingredient module
 * in `@norish/shared-server/ingredients` checks the edit policy and calls
 * these writers, as the resolver calls the minting ones.
 */

/** One Ingredient as the page lists it, with every spelling it is known by. */
export interface CatalogueIngredient {
  id: string;
  name: string;
  flagged: boolean;
  ownerId: string | null;
  version: number;
  aliases: CatalogueAlias[];
}

export interface CatalogueAlias {
  id: string;
  text: string;
  ownerId: string | null;
}

/** Who owns a row of the catalogue, which is what the edit policy is asked about. */
export interface CatalogueOwner {
  ownerId: string | null;
}

/**
 * Whether `error` is Postgres refusing a write on a constraint of this class:
 * `23505` a unique violation, `23503` a foreign-key one. Drizzle wraps the
 * driver's error, so its cause is read too.
 */
function isConstraintViolation(error: unknown, code: "23505" | "23503"): boolean {
  for (let current = error; current && typeof current === "object";) {
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** A `LIKE` pattern matching `text` anywhere, its wildcards taken literally. */
function containing(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * A page of the catalogue by name: every Ingredient, or the flagged ones, or
 * those whose name or any spelling contains the search — matched on the fold,
 * so "creme" finds "Crème fraîche".
 */
export async function listCatalogueIngredients(query: {
  search: { lower: string; fold: string } | null;
  flaggedOnly: boolean;
  limit: number;
  offset: number;
}): Promise<CatalogueIngredient[]> {
  const matchesSearch = query.search
    ? or(
        sql`lower(${ingredients.name}) like ${containing(query.search.lower)}`,
        query.search.fold
          ? sql`exists (select 1 from ${ingredientAliases} where ${ingredientAliases.ingredientId} = ${ingredients.id} and ${ingredientAliases.fold} like ${containing(query.search.fold)})`
          : undefined
      )
    : undefined;

  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      flagged: ingredients.flagged,
      ownerId: ingredients.ownerId,
      version: ingredients.version,
    })
    .from(ingredients)
    .where(and(query.flaggedOnly ? eq(ingredients.flagged, true) : undefined, matchesSearch))
    .orderBy(asc(sql`lower(${ingredients.name})`), asc(ingredients.id))
    .limit(query.limit)
    .offset(query.offset);

  if (rows.length === 0) return [];

  const aliases = await db
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      ownerId: ingredientAliases.ownerId,
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

  return rows.map((row) => ({
    ...row,
    aliases: aliases
      .filter((alias) => alias.ingredientId === row.id)
      .map(({ ingredientId: _ingredientId, ...alias }) => alias),
  }));
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
): Promise<(CatalogueOwner & { ingredientId: string }) | null> {
  const [row] = await db
    .select({ ownerId: ingredientAliases.ownerId, ingredientId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.id, aliasId))
    .limit(1);

  return row ?? null;
}

/** Whether another Ingredient already goes by this name, in any case. */
export async function isIngredientNameTaken(name: string, exceptId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(
        eq(sql`lower(${ingredients.name})`, name.toLowerCase()),
        sql`${ingredients.id} <> ${exceptId}`
      )
    )
    .limit(1);

  return Boolean(row);
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
      .set({ name, flagged: false, version: sql`${ingredients.version} + 1` })
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
    .set({ flagged: false, version: sql`${ingredients.version} + 1` })
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
