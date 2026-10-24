import type { SQL } from "drizzle-orm";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import { db, holdLock } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  householdUsers,
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recurringGroceries,
  storeProductLinks,
} from "@norish/db/schema";
import { distinctFoods, joinOf } from "@norish/shared/lib/line-foods";

import { moveMergedAIChanges } from "./ingredient-ai-changes";
import { rowsNaming } from "./ingredient-catalogue";
import { writeRecipeLineFoodsTx } from "./ingredients";
import { lockPantryFood } from "./pantry";

/**
 * What moves between Ingredients (ADR-0037): a merge, an alias move, a parent. Each takes the tree
 * lock first, inside the edit's transaction; the edit policy is the caller's.
 */

/**
 * Rows holding a fact about an Ingredient, unique on it plus one column: a Product and Aisle Link
 * per Store; a store preference, correction and Pantry row per member.
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
 * Re-point the rows `which` picks out of `table` (as `p`) at `targetId`, deleting each one the
 * target already has under the table's key.
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
 * A merge or move can leave a household two Pantry rows for `targetId` (one per member): the oldest
 * stays, under the add's `pantry:<ingredient>` lock.
 */
async function keepOnePantryRowPerHousehold(tx: DbTransaction, targetId: string): Promise<void> {
  await lockPantryFood(tx, targetId);
  await tx.execute(sql`
    delete from ${pantryIngredients} p
    using ${pantryIngredients} q, ${householdUsers} hp, ${householdUsers} hq
    where p.ingredient_id = ${targetId} and q.ingredient_id = ${targetId} and p.id <> q.id
      and hp.user_id = p.user_id and hq.user_id = q.user_id and hp.household_id = hq.household_id
      and (q.created_at, q.id) < (p.created_at, p.id)`);
}

/**
 * Serialise changes to the tree of parents: two changes that are each acyclic can close a cycle
 * together. Released with the transaction.
 */
export async function lockTree(tx: DbTransaction): Promise<void> {
  await holdLock(tx, "ingredient-tree");
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

/** Take the tree lock, then the foods' rows; false where one of `ids` is gone. */
export async function lockFoods(tx: DbTransaction, ids: readonly string[]): Promise<boolean> {
  await lockTree(tx);

  return (await lockIngredients(tx, ids)) === new Set(ids).size;
}

/** How deep the tree is ever walked: a guard, since the tree has no cycle to loop on. The seed walks as deep. */
const MAX_DEPTH = 64;

/**
 * Every ancestor of each Ingredient, nearest first: its parent, the parent's
 * parent, and so on. An Ingredient with no parent answers an empty list.
 */
async function ancestorsOf(tx: Db, ids: readonly string[]): Promise<Map<string, string[]>> {
  const wanted = Array.from(new Set(ids));

  if (wanted.length === 0) return new Map();

  const answer = new Map(wanted.map((id) => [id, [] as string[]]));

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
  tx: Db = db
): Promise<Map<string, string[]>> {
  return await ancestorsOf(tx, ids);
}

/** Whether filing `id` under `parentId` closes a cycle: the parent is the food or sits under it. */
export async function closesCycle(tx: Db, id: string, parentId: string): Promise<boolean> {
  return id === parentId || !!(await ancestorsOf(tx, [parentId])).get(parentId)?.includes(id);
}

/**
 * Set or clear (`null`) a parent. A person's choice also marks it chosen and clears the flag; AI's
 * (`byAI`) does neither. The caller holds the tree lock and has ruled out a cycle.
 */
export async function setCatalogueIngredientParent(
  tx: DbTransaction,
  id: string,
  parentId: string | null,
  { byAI = false }: { byAI?: boolean } = {}
): Promise<void> {
  await tx
    .update(ingredients)
    .set({
      parentId,
      ...(byAI ? {} : { parentChosen: true, flagged: false, flagReason: null }),
      version: sql`${ingredients.version} + 1`,
    })
    .where(eq(ingredients.id, id));
}

/**
 * Merge source into target, locking both: spellings and rows move, links unless the target has its
 * own; its OFF id and icon fill gaps, the flag clears unless `keepFlag`. False where one is gone.
 */
export async function mergeCatalogueIngredients(
  tx: DbTransaction,
  sourceId: string,
  targetId: string,
  { keepFlag = false }: { keepFlag?: boolean } = {}
): Promise<boolean> {
  if (sourceId === targetId || !(await lockFoods(tx, [sourceId, targetId]))) return false;

  // Where the target sat under the source it first moves up to the source's parent, so the children
  // re-parented onto it can never close a cycle.
  if ((await ancestorsOf(tx, [targetId])).get(targetId)?.includes(sourceId)) {
    await tx.execute(sql`
      update ${ingredients} set parent_id = (select parent_id from ${ingredients} where id = ${sourceId})
      where id = ${targetId}`);
  }
  await tx
    .update(ingredients)
    .set({ parentId: targetId })
    .where(eq(ingredients.parentId, sourceId));
  await moveMergedAIChanges(tx, sourceId, targetId);

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
  // A person's merge settles the target's flag. A source hands on its Open Food Facts id
  // and icon where the target has none, so the nightly seed keeps finding the food.
  const [gone] = await tx
    .delete(ingredients)
    .where(eq(ingredients.id, sourceId))
    .returning({ offId: ingredients.offId, icon: ingredients.icon });

  await tx.execute(sql`update ${ingredients} set version = version + 1,
      ${keepFlag ? sql`` : sql`flagged = false, flag_reason = null,`}
      off_id = coalesce(off_id, ${gone?.offId ?? null}),
      icon = coalesce(icon, ${gone?.icon ?? null})
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
 * A new Ingredient named for a spelling moved out to it, by a person or AI's split. Its
 * name is unique, so one another Ingredient goes by throws a unique violation.
 */
export async function insertCatalogueIngredient(
  tx: DbTransaction,
  values: Pick<typeof ingredients.$inferInsert, "name" | "ownerId" | "flagged" | "flagReason">
): Promise<string> {
  const [row] = await tx.insert(ingredients).values(values).returning({ id: ingredients.id });

  return row!.id;
}

/** The food that goes by `name` in any case, locked, or null. */
export async function lockIngredientNamed(tx: DbTransaction, name: string): Promise<string | null> {
  const [row] = await tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(sql`lower(${ingredients.name})`, sql`lower(${name})`))
    .for("update");

  return row?.id ?? null;
}

/**
 * Move one spelling to another Ingredient (the unmerge): its rows go with it, links stay, a Pantry
 * duplicate folds. The caller holds the tree lock and both rows, the source kept a spelling.
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

/** One food a split gives a row: the spelling its part resolved to, that food, and the part as written. */
export interface SplitPart {
  aliasId: string;
  ingredientId: string;
  text: string;
}

/**
 * Point every row naming a food at the parts it splits into, then delete it (ADR-0037); the caller
 * holds the tree lock and the foods' locks.
 */
export async function splitCatalogueIngredient(
  tx: DbTransaction,
  sourceId: string,
  parts: readonly [SplitPart, ...SplitPart[]],
  joined: LineJoin
): Promise<void> {
  const naming = rowsNaming(sourceId);
  const lineRows = await tx
    .select({
      lineId: recipeIngredientFoods.recipeIngredientId,
      aliasId: recipeIngredientFoods.ingredientAliasId,
      ingredientId: ingredientAliases.ingredientId,
      joined: recipeIngredients.joined,
    })
    .from(recipeIngredientFoods)
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .innerJoin(
      recipeIngredients,
      eq(recipeIngredients.id, recipeIngredientFoods.recipeIngredientId)
    )
    .where(
      inArray(
        recipeIngredientFoods.recipeIngredientId,
        tx
          .select({ id: recipeIngredientFoods.recipeIngredientId })
          .from(recipeIngredientFoods)
          .where(naming.lineFoods)
      )
    )
    .orderBy(asc(recipeIngredientFoods.recipeIngredientId), asc(recipeIngredientFoods.position));
  const lines = new Map<string, { joined: LineJoin | null; foods: SplitPart[] }>();

  for (const row of lineRows) {
    const line = lines.get(row.lineId) ?? { joined: row.joined, foods: [] };

    line.foods.push(...(row.ingredientId === sourceId ? parts : [{ ...row, text: "" }]));
    lines.set(row.lineId, line);
  }
  for (const line of lines.values()) line.foods = distinctFoods(line.foods);
  await writeRecipeLineFoodsTx(
    tx,
    [...lines].map(([id, line]) => ({ id, aliasIds: line.foods.map((food) => food.aliasId) }))
  );
  for (const [id, line] of lines) {
    await tx
      .update(recipeIngredients)
      .set({
        joined: joinOf(line.foods, line.joined ?? joined),
        version: sql`${recipeIngredients.version} + 1`,
      })
      .where(eq(recipeIngredients.id, id));
  }

  const [first, ...rest] = parts;
  const others = joined === "together" ? rest : [];
  const groceryParts = [first, ...others].map((part) => ({
    name: part.text,
    aliasId: part.aliasId,
    ingredientId: part.ingredientId,
  }));
  const namingIds = (table: typeof groceries | typeof recurringGroceries, where: SQL | undefined) =>
    tx.select({ id: table.id, name: table.name }).from(table).where(where);

  for (const [kind, rows] of [
    ["groceries", await namingIds(groceries, naming.groceries)],
    ["recurring", await namingIds(recurringGroceries, naming.recurringGroceries)],
  ] as const) {
    await writeGroceryParts(
      tx,
      kind,
      rows.map(({ id, name }) => ({ id, name, parts: groceryParts }))
    );
  }

  const keepers = await tx
    .select({ userId: pantryIngredients.userId })
    .from(pantryIngredients)
    .where(eq(pantryIngredients.ingredientId, sourceId));

  for (const part of keepers.length > 0 ? parts : []) {
    await tx
      .insert(pantryIngredients)
      .values(
        keepers.map(({ userId }) => ({
          userId,
          ingredientId: part.ingredientId,
          ingredientAliasId: part.aliasId,
        }))
      )
      .onConflictDoNothing();
    await keepOnePantryRowPerHousehold(tx, part.ingredientId);
  }
  await tx.delete(ingredients).where(eq(ingredients.id, sourceId));
}

/** A food a Grocery names, and the name it goes by there. */
export interface GroceryPart {
  name: string;
  aliasId: string | null;
  ingredientId: string | null;
}

/**
 * Point Groceries or recurring groceries at the foods they name: the first on the row itself, each
 * other one on a copy of it, as a Grocery names one food (ADR-0037).
 */
export async function writeGroceryParts(
  tx: DbTransaction,
  kind: "groceries" | "recurring",
  /** `name`: the text the parts were read from; a row renamed since is left alone. */
  rows: ReadonlyArray<{ id: string; name: string | null; parts: readonly GroceryPart[] }>
): Promise<void> {
  const table = kind === "groceries" ? groceries : recurringGroceries;
  const columns = (part: GroceryPart) => ({
    name: part.name,
    ingredientAliasId: part.aliasId,
    ingredientId: part.ingredientId,
  });

  for (const {
    id,
    name,
    parts: [first, ...rest],
  } of rows) {
    if (!first) continue;
    const [row] = await tx
      .update(table)
      .set({ ...columns(first), version: sql`${table.version} + 1` })
      .where(and(eq(table.id, id), sql`${table.name} is not distinct from ${name}`))
      .returning();

    if (!row) continue;
    const { id: _id, version: _version, ...copy } = row;

    // ponytail: a copy of a recurring grocery's row recurs with neither; link them if it matters.
    for (const part of rest) {
      await tx.insert(table).values({
        ...copy,
        ...columns(part),
        ...("recurringGroceryId" in copy && { recurringGroceryId: null }),
      });
    }
  }
}
