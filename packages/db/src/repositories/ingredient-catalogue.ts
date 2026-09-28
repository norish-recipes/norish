import type { SQL } from "drizzle-orm";
import { and, asc, count, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  ingredientAliases,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recipeIngredients,
  recurringGroceries,
  storeProductLinks,
} from "@norish/db/schema";

import { isConstraintViolation } from "./constraint-violation";

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

  const parents = alias(ingredients, "parent");
  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      flagged: ingredients.flagged,
      ownerId: ingredients.ownerId,
      version: ingredients.version,
      parentId: parents.id,
      parentName: parents.name,
    })
    .from(ingredients)
    .leftJoin(parents, eq(parents.id, ingredients.parentId))
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

/**
 * The rows that hold a fact about an Ingredient, each unique on the
 * Ingredient and one other column: at most one Product Link and one Aisle
 * Link per Store, one store preference and one Pantry Ingredient per member.
 */
const PANTRY_KEYED = { table: pantryIngredients, key: "user_id" } as const;
const KEYED_BY_INGREDIENT = [
  { table: storeProductLinks, key: "store_id" },
  { table: aisleLinks, key: "store_id" },
  { table: ingredientStorePreferences, key: "user_id" },
  PANTRY_KEYED,
] as const;

/**
 * Re-point the rows `which` picks out of `table` (as `p`) at `targetId`. A row
 * that would become a second one for the target under the table's key is
 * deleted instead: the target's own is kept.
 */
async function repointKeyed(
  tx: DbTransaction,
  { table, key }: (typeof KEYED_BY_INGREDIENT)[number],
  which: SQL,
  targetId: string
): Promise<void> {
  const column = sql.identifier(key);

  await tx.execute(sql`
    delete from ${table} p using ${table} q
    where ${which} and q.ingredient_id = ${targetId} and q.${column} = p.${column} and q.id <> p.id`);
  await tx.execute(sql`update ${table} p set ingredient_id = ${targetId} where ${which}`);
}

/**
 * Serialise every change to the tree of Parent Ingredients: two changes that
 * are each acyclic can close a cycle together, so each checks the tree as the
 * one before it left it. Released with the transaction.
 */
export async function lockTree(tx: DbTransaction): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ingredient-tree'))`);
}

/** How deep the tree is ever walked: a guard, since the tree has no cycle to loop on. */
const MAX_DEPTH = 32;

/**
 * Every ancestor of each Ingredient, nearest first: its parent, the parent's
 * parent, and so on. An Ingredient with no parent answers an empty list.
 */
async function ancestorsOf(
  tx: typeof db | DbTransaction,
  ids: readonly string[]
): Promise<Map<string, string[]>> {
  const wanted = Array.from(new Set(ids));
  const answer = new Map(wanted.map((id) => [id, [] as string[]]));

  if (wanted.length === 0) return answer;

  const result = await tx.execute<{ start: string; ancestor: string; depth: number }>(sql`
    with recursive up(start, ancestor, depth) as (
      select i.id, i.parent_id, 1 from ${ingredients} i
      where i.id in (${sql.join(
        wanted.map((id) => sql`${id}::uuid`),
        sql`, `
      )}) and i.parent_id is not null
      union all
      select up.start, p.parent_id, up.depth + 1 from up
      join ${ingredients} p on p.id = up.ancestor
      where p.parent_id is not null and up.depth < ${MAX_DEPTH}
    )
    select start::text as start, ancestor::text as ancestor, depth from up order by start, depth`);

  for (const row of result.rows) answer.get(row.start)?.push(row.ancestor);

  return answer;
}

/** Every ancestor of each Ingredient, nearest first. */
export async function findIngredientAncestors(
  ids: readonly string[]
): Promise<Map<string, string[]>> {
  return await ancestorsOf(db, ids);
}

/**
 * Set an Ingredient's Parent Ingredient, or clear it (`parentId` null), and
 * clear its flag: looking after a Flagged Ingredient counts as reviewing it.
 * A parent that is the Ingredient itself or one of its descendants would
 * close a cycle, and is refused.
 */
export async function setCatalogueIngredientParent(
  id: string,
  parentId: string | null
): Promise<"set" | "missing" | "cycle"> {
  return await db.transaction(async (tx) => {
    if (parentId === id) return "cycle";
    await lockTree(tx);

    const ids = parentId ? [id, parentId] : [id];

    if ((await lockIngredients(tx, ids)) < ids.length) return "missing";
    if (parentId && (await ancestorsOf(tx, [parentId])).get(parentId)?.includes(id)) {
      return "cycle";
    }

    await tx
      .update(ingredients)
      .set({
        parentId,
        parentChosen: true,
        flagged: false,
        version: sql`${ingredients.version} + 1`,
      })
      .where(eq(ingredients.id, id));

    return "set";
  });
}

/** Lock Ingredients for an edit, in id order so two edits over the same pair never deadlock. */
async function lockIngredients(tx: DbTransaction, ids: readonly string[]): Promise<number> {
  const rows = await tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(inArray(ingredients.id, [...ids]))
    .orderBy(asc(ingredients.id))
    .for("update");

  return rows.length;
}

/**
 * Merge one Ingredient into another: every spelling of the source becomes
 * the target's, so every recipe line, grocery and Pantry Ingredient behind
 * them now means the target, and the source is deleted. What the household
 * taught Norish about the source — Product Links, Aisle Links, store
 * preferences — joins the target, except where the target already has one
 * at that Store (or for that member): the target's is kept. A member who held
 * both foods in the Pantry keeps the one Pantry Ingredient.
 */
export async function mergeCatalogueIngredients(
  sourceId: string,
  targetId: string
): Promise<"merged" | "missing"> {
  return await db.transaction(async (tx) => {
    await lockTree(tx);
    if ((await lockIngredients(tx, [sourceId, targetId])) < 2) return "missing";

    // The target takes the source's place in the tree: where it sat under the
    // source, it moves up to the source's parent first, so the source's
    // children re-parented onto it can never close a cycle.
    if ((await ancestorsOf(tx, [targetId])).get(targetId)?.includes(sourceId)) {
      await tx.execute(sql`
        update ${ingredients} set parent_id = (select parent_id from ${ingredients} where id = ${sourceId})
        where id = ${targetId}`);
    }
    await tx
      .update(ingredients)
      .set({ parentId: targetId })
      .where(eq(ingredients.parentId, sourceId));

    for (const keyed of KEYED_BY_INGREDIENT) {
      await repointKeyed(tx, keyed, sql`p.ingredient_id = ${sourceId}`, targetId);
    }
    for (const table of [groceries, recurringGroceries]) {
      await tx
        .update(table)
        .set({ ingredientId: targetId })
        .where(eq(table.ingredientId, sourceId));
    }
    await tx
      .update(ingredientAliases)
      .set({ ingredientId: targetId, updatedAt: new Date() })
      .where(eq(ingredientAliases.ingredientId, sourceId));
    await tx.delete(ingredients).where(eq(ingredients.id, sourceId));

    return "merged";
  });
}

/**
 * Move one spelling to another Ingredient, or to a new one named for it
 * (`mint`): the unmerge. The lines behind the spelling go with it; the
 * Product Links, Aisle Links and store preferences stay with the food they
 * were learned for. A member whose Pantry Ingredient lands on a food they
 * already hold keeps the one. An Ingredient keeps at least one spelling.
 * Answers the Ingredient the spelling now names.
 */
export async function moveCatalogueAlias(
  aliasId: string,
  target: { ingredientId: string } | { mint: { name: string; ownerId: string } }
): Promise<
  { outcome: "moved"; ingredientId: string } | { outcome: "missing" | "last" | "name-taken" }
> {
  try {
    return await db.transaction(async (tx) => {
      const [alias] = await tx
        .select({ ingredientId: ingredientAliases.ingredientId })
        .from(ingredientAliases)
        .where(eq(ingredientAliases.id, aliasId));

      if (!alias) return { outcome: "missing" as const };

      const sourceId = alias.ingredientId;
      const targetIds = "ingredientId" in target ? [target.ingredientId] : [];

      if ((await lockIngredients(tx, [sourceId, ...targetIds])) < 1 + targetIds.length) {
        return { outcome: "missing" as const };
      }
      if (targetIds[0] === sourceId) return { outcome: "moved" as const, ingredientId: sourceId };

      const [{ value: siblings } = { value: 0 }] = await tx
        .select({ value: count() })
        .from(ingredientAliases)
        .where(eq(ingredientAliases.ingredientId, sourceId));

      if (siblings <= 1) return { outcome: "last" as const };

      const targetId =
        "ingredientId" in target
          ? target.ingredientId
          : (
              await tx
                .insert(ingredients)
                .values({ name: target.mint.name, ownerId: target.mint.ownerId })
                .returning({ id: ingredients.id })
            )[0]!.id;

      await tx
        .update(ingredientAliases)
        .set({ ingredientId: targetId, updatedAt: new Date() })
        .where(eq(ingredientAliases.id, aliasId));
      await repointKeyed(tx, PANTRY_KEYED, sql`p.ingredient_alias_id = ${aliasId}`, targetId);
      for (const table of [groceries, recurringGroceries]) {
        await tx
          .update(table)
          .set({ ingredientId: targetId })
          .where(eq(table.ingredientAliasId, aliasId));
      }

      return { outcome: "moved" as const, ingredientId: targetId };
    });
  } catch (error) {
    // The new Ingredient's name is one another Ingredient goes by.
    if (isConstraintViolation(error, "23505")) return { outcome: "name-taken" };
    throw error;
  }
}
