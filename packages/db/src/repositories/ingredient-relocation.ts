import type { SQL } from "drizzle-orm";
import { asc, count, eq, inArray, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  householdUsers,
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recurringGroceries,
  storeProductLinks,
} from "@norish/db/schema";

/**
 * What moves between Ingredients (ADR-0037): a merge, an alias moved to
 * another Ingredient or a new one (the unmerge), and a Parent Ingredient set
 * or cleared. Each takes the tree lock first, so the tree of parents is
 * changed one edit at a time and two edits over one pair of rows never
 * deadlock. Every writer takes the edit's transaction, so an edit is one unit.
 * Nothing here decides who may edit what: the ingredient module in
 * `@norish/shared-server/ingredients` checks the edit policy and calls these.
 */

/**
 * The rows that hold a fact about an Ingredient, each unique on the
 * Ingredient and one other column: at most one Product Link and one Aisle
 * Link per Store, one store preference, one nutrition correction and one
 * Pantry Ingredient per member.
 */
const PANTRY_KEYED = { table: pantryIngredients, key: "user_id" } as const;
const KEYED_BY_INGREDIENT = [
  { table: storeProductLinks, key: "store_id" },
  { table: aisleLinks, key: "store_id" },
  { table: ingredientStorePreferences, key: "user_id" },
  { table: ingredientNutritionCorrections, key: "user_id" },
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
 * The Pantry is one list per household, kept so by the add (which looks
 * across the household under the `pantry:<ingredient>` lock) rather than by
 * the row's per-member key. Rows that a merge or move has just re-pointed at
 * `targetId` can put one food in a household twice, once per member; the
 * oldest row stays. Under the same lock, so an add landing meanwhile sees
 * what this left.
 */
async function keepOnePantryRowPerHousehold(tx: DbTransaction, targetId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`pantry:${targetId}`}::text))`);
  await tx.execute(sql`
    delete from ${pantryIngredients} p
    using ${pantryIngredients} q, ${householdUsers} hp, ${householdUsers} hq
    where p.ingredient_id = ${targetId} and q.ingredient_id = ${targetId} and p.id <> q.id
      and hp.user_id = p.user_id and hq.user_id = q.user_id and hp.household_id = hq.household_id
      and (q.created_at, q.id) < (p.created_at, p.id)`);
}

/**
 * Serialise every change to the tree of Parent Ingredients: two changes that
 * are each acyclic can close a cycle together, so each checks the tree as the
 * one before it left it. Released with the transaction.
 */
export async function lockTree(tx: DbTransaction): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ingredient-tree'))`);
}

/** Lock Ingredients for an edit, in id order so two edits over the same pair never deadlock. */
export async function lockIngredients(tx: DbTransaction, ids: readonly string[]): Promise<number> {
  const rows = await tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(inArray(ingredients.id, [...ids]))
    .orderBy(asc(ingredients.id))
    .for("update");

  return rows.length;
}

/** How deep the tree is ever walked: a guard, since the tree has no cycle to loop on. The seed walks as deep. */
const MAX_DEPTH = 64;

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

/** Every ancestor of each Ingredient, nearest first; read through `tx` when an edit is asking. */
export async function findIngredientAncestors(
  ids: readonly string[],
  tx: typeof db | DbTransaction = db
): Promise<Map<string, string[]>> {
  return await ancestorsOf(tx, ids);
}

/**
 * Set an Ingredient's Parent Ingredient, or clear it (`parentId` null), and
 * clear its flag: looking after a Flagged Ingredient counts as reviewing it.
 * The caller holds the tree lock and has ruled out a cycle.
 */
export async function setCatalogueIngredientParent(
  tx: DbTransaction,
  id: string,
  parentId: string | null
): Promise<void> {
  await tx
    .update(ingredients)
    .set({
      parentId,
      parentChosen: true,
      flagged: false,
      flagReason: null,
      version: sql`${ingredients.version} + 1`,
    })
    .where(eq(ingredients.id, id));
}

/**
 * Merge one Ingredient into another: every spelling of the source becomes
 * the target's, so every recipe line, grocery and Pantry Ingredient behind
 * them now means the target, and the source is deleted. What the household
 * taught Norish about the source — Product Links, Aisle Links, store
 * preferences — joins the target, except where the target already has one
 * at that Store (or for that member): the target's is kept. A household that
 * held both foods in the Pantry keeps the one Pantry Ingredient. The target's
 * flag is cleared, and it takes the source's Open Food Facts id when it has
 * none, so the seed keeps finding the food. Takes the tree lock and both
 * rows itself; false, and nothing written, where either is gone.
 */
export async function mergeCatalogueIngredients(
  tx: DbTransaction,
  sourceId: string,
  targetId: string
): Promise<boolean> {
  await lockTree(tx);
  if ((await lockIngredients(tx, [sourceId, targetId])) < 2) return false;

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
  await keepOnePantryRowPerHousehold(tx, targetId);
  for (const table of [groceries, recurringGroceries]) {
    await tx.update(table).set({ ingredientId: targetId }).where(eq(table.ingredientId, sourceId));
  }
  await tx
    .update(ingredientAliases)
    .set({ ingredientId: targetId, updatedAt: new Date() })
    .where(eq(ingredientAliases.ingredientId, sourceId));
  // The target is what a person decided the food is: that settles its flag.
  // A seeded source hands its Open Food Facts id on where the target has
  // none, so the nightly seed keeps finding the food instead of minting it again.
  const [gone] = await tx
    .delete(ingredients)
    .where(eq(ingredients.id, sourceId))
    .returning({ offId: ingredients.offId });

  await tx.execute(sql`
    update ${ingredients} set flagged = false, flag_reason = null, version = version + 1,
      off_id = coalesce(off_id, ${gone?.offId ?? null})
    where id = ${targetId}`);

  return true;
}

/** How many spellings an Ingredient has. */
export async function countAliasesOf(tx: DbTransaction, ingredientId: string): Promise<number> {
  const [{ value } = { value: 0 }] = await tx
    .select({ value: count() })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.ingredientId, ingredientId));

  return value;
}

/**
 * A new Ingredient a person made, named for a spelling moved out to it. Its
 * name is unique, so one another Ingredient goes by throws a unique violation.
 */
export async function insertCatalogueIngredient(
  tx: DbTransaction,
  values: { name: string; ownerId: string }
): Promise<string> {
  const [row] = await tx.insert(ingredients).values(values).returning({ id: ingredients.id });

  return row!.id;
}

/**
 * Move one spelling to another Ingredient: the unmerge. The lines behind the
 * spelling go with it; the Product Links, Aisle Links and store preferences
 * stay with the food they were learned for. A household whose Pantry
 * Ingredient lands on a food it already holds keeps the one. The caller holds
 * the tree lock and both rows, and has kept the source a spelling.
 */
export async function moveCatalogueAlias(
  tx: DbTransaction,
  aliasId: string,
  targetId: string
): Promise<void> {
  await tx
    .update(ingredientAliases)
    .set({ ingredientId: targetId, updatedAt: new Date() })
    .where(eq(ingredientAliases.id, aliasId));
  await repointKeyed(tx, PANTRY_KEYED, sql`p.ingredient_alias_id = ${aliasId}`, targetId);
  await keepOnePantryRowPerHousehold(tx, targetId);
  for (const table of [groceries, recurringGroceries]) {
    await tx
      .update(table)
      .set({ ingredientId: targetId })
      .where(eq(table.ingredientAliasId, aliasId));
  }
}
