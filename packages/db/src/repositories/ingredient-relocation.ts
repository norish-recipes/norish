import type { SQL } from "drizzle-orm";
import { asc, count, eq, inArray, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  householdUsers,
  ingredientAliases,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recurringGroceries,
  storeProductLinks,
} from "@norish/db/schema";

import { isConstraintViolation } from "./constraint-violation";

/**
 * What moves between Ingredients (ADR-0037): a merge, an alias moved to
 * another Ingredient or a new one (the unmerge), and a Parent Ingredient set
 * or cleared. Each takes the tree lock first, so the tree of parents is
 * changed one edit at a time and two edits over one pair of rows never
 * deadlock. Nothing here decides who may edit what: the ingredient module in
 * `@norish/shared-server/ingredients` checks the edit policy and calls these.
 */

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
        flagReason: null,
        version: sql`${ingredients.version} + 1`,
      })
      .where(eq(ingredients.id, id));

    return "set";
  });
}

/**
 * Merge one Ingredient into another: every spelling of the source becomes
 * the target's, so every recipe line, grocery and Pantry Ingredient behind
 * them now means the target, and the source is deleted. What the household
 * taught Norish about the source — Product Links, Aisle Links, store
 * preferences — joins the target, except where the target already has one
 * at that Store (or for that member): the target's is kept. A household that
 * held both foods in the Pantry keeps the one Pantry Ingredient.
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
    await keepOnePantryRowPerHousehold(tx, targetId);
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
 * were learned for. A household whose Pantry Ingredient lands on a food it
 * already holds keeps the one. An Ingredient keeps at least one spelling.
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
      // Every catalogue move and merge takes the tree lock first, so they run
      // one at a time (a nightly seed included) and never deadlock on rows,
      // and the alias read under it is where it still is.
      await lockTree(tx);

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
      await keepOnePantryRowPerHousehold(tx, targetId);
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
