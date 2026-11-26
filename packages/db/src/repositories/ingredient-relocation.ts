import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, asc, count, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import { db, holdLock } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
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

import { isAnyOf } from "./array-params";
import { assertOwnReferences } from "./household-rows";
import { inCatalogue, ownBeforeSeed } from "./household-scope";
import { moveMergedAIChanges } from "./ingredient-ai-changes";
import { rowsNaming, spellingsSeenBy } from "./ingredient-catalogue";
import { ancestryCte } from "./ingredient-kinds";
import { writeRecipeLineFoodsTx } from "./ingredients";
import { lockPantryFood } from "./pantry";
import { rekeyNutritionSharesTx } from "./recipe-enrichment";

const qb = new QueryBuilder();

/**
 * What moves between Ingredients (ADR-0037): a merge, an alias move, a parent. Each takes the tree
 * lock first, inside the edit's transaction; the rights are the caller's. Nothing moves between
 * households, nor from the seed into a household (ADR-0042).
 */

/**
 * Whether `targetId` is a food `sourceId` may be merged into or filed under: the seed's, or one of
 * the source's household. A seeded food never goes into a household's.
 */
export async function fitsInCatalogueOf(
  tx: Db,
  sourceId: string,
  targetId: string
): Promise<boolean> {
  const rows = await tx
    .select({ id: ingredients.id, householdId: ingredients.householdId })
    .from(ingredients)
    .where(inArray(ingredients.id, [sourceId, targetId]));
  const source = rows.find((row) => row.id === sourceId);
  const target = rows.find((row) => row.id === targetId);

  return (
    source !== undefined &&
    target !== undefined &&
    (target.householdId === null || target.householdId === source.householdId)
  );
}

/**
 * Rows holding a fact about an Ingredient, unique on it plus one column: a Product and Aisle Link
 * per Store; a store preference, correction and Pantry row per household.
 */
const PANTRY_KEYED = { table: pantryIngredients, key: pantryIngredients.householdId } as const;
const KEYED_BY_INGREDIENT = [
  { table: storeProductLinks, key: storeProductLinks.storeId },
  { table: aisleLinks, key: aisleLinks.storeId },
  { table: ingredientStorePreferences, key: ingredientStorePreferences.householdId },
  { table: ingredientNutritionCorrections, key: ingredientNutritionCorrections.householdId },
  PANTRY_KEYED,
] as const;

/**
 * Re-point the rows `which` picks out of `table` at `targetId`, deleting each one the target
 * already has under the table's key.
 */
async function repointKeyed(
  tx: DbTransaction,
  { table, key }: (typeof KEYED_BY_INGREDIENT)[number],
  which: SQL,
  targetId: string
): Promise<void> {
  // The inner `table` is the target's rows: one of `which` whose key the target holds goes.
  await tx
    .delete(table)
    .where(
      and(
        which,
        ne(table.ingredientId, targetId),
        inArray(key, qb.select({ key }).from(table).where(eq(table.ingredientId, targetId)))
      )
    );
  await tx.update(table).set({ ingredientId: targetId }).where(which);
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
    .where(isAnyOf(ingredients.id, ids, "uuid"))
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

  const walked = ancestryCte(inArray(ingredients.id, wanted), MAX_DEPTH);
  const rows = await tx.with(walked).select().from(walked).orderBy(walked.start, walked.depth);

  for (const row of rows) answer.get(row.start)?.push(row.ancestor);

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
 * Set or clear (`null`) a parent of the food's own catalogue (`fitsInCatalogueOf`), else false. A
 * person's choice also marks it chosen and clears the flag; AI's (`byAI`) does neither. The caller
 * holds the tree lock and has ruled out a cycle.
 */
export async function setCatalogueIngredientParent(
  tx: DbTransaction,
  id: string,
  parentId: string | null,
  { byAI = false }: { byAI?: boolean } = {}
): Promise<boolean> {
  if (parentId && !(await fitsInCatalogueOf(tx, id, parentId))) return false;
  await tx
    .update(ingredients)
    .set({
      parentId,
      ...(byAI ? {} : { parentChosen: true, flagged: false, flagReason: null }),
      version: sql`${ingredients.version} + 1`,
    })
    .where(eq(ingredients.id, id));

  return true;
}

/**
 * Merge source into target, locking both: spellings and rows move, links unless the target has its
 * own; its icon fills a gap, the flag clears unless `keepFlag`. A seeded target's row is left as it
 * is: the household's spellings stay the household's on it. False where one is gone, or the target
 * is neither the source's household's nor the seed's (`fitsInCatalogueOf`).
 */
export async function mergeCatalogueIngredients(
  tx: DbTransaction,
  sourceId: string,
  targetId: string,
  options: { keepFlag?: boolean } = {}
): Promise<boolean> {
  if (sourceId === targetId || !(await lockFoods(tx, [sourceId, targetId]))) return false;
  if (!(await fitsInCatalogueOf(tx, sourceId, targetId))) return false;
  await mergeLockedFoods(tx, sourceId, targetId, options);

  return true;
}

/** The merge itself, both foods locked; the caller has checked where they may go. */
export async function mergeLockedFoods(
  tx: DbTransaction,
  sourceId: string,
  targetId: string,
  { keepFlag = false }: { keepFlag?: boolean }
): Promise<void> {
  // Where the target sat under the source it first moves up to the source's parent, so the children
  // re-parented onto it can never close a cycle.
  if ((await ancestorsOf(tx, [targetId])).get(targetId)?.includes(sourceId)) {
    const [source] = await tx
      .select({ parentId: ingredients.parentId })
      .from(ingredients)
      .where(eq(ingredients.id, sourceId));

    await tx
      .update(ingredients)
      .set({ parentId: source?.parentId ?? null })
      .where(eq(ingredients.id, targetId));
  }
  await tx
    .update(ingredients)
    .set({ parentId: targetId })
    .where(eq(ingredients.parentId, sourceId));
  await moveMergedAIChanges(tx, sourceId, targetId);

  // Under the add's `pantry:<ingredient>` lock, so a Pantry add of the target waits for the move.
  await lockPantryFood(tx, targetId);
  for (const keyed of KEYED_BY_INGREDIENT) {
    await repointKeyed(tx, keyed, eq(keyed.table.ingredientId, sourceId), targetId);
  }
  for (const table of [groceries, recurringGroceries]) {
    await tx.update(table).set({ ingredientId: targetId }).where(eq(table.ingredientId, sourceId));
  }
  await rekeyNutritionSharesTx(tx, recipesNaming(sourceId), new Map([[sourceId, targetId]]));
  await tx
    .update(ingredientAliases)
    .set({ ingredientId: targetId, updatedAt: new Date() })
    .where(eq(ingredientAliases.ingredientId, sourceId));
  // A person's merge settles the target's flag. A source hands on its icon where the target has
  // none; a seeded source only ever joins a seeded target, which keeps its own Open Food Facts id.
  const [gone] = await tx
    .delete(ingredients)
    .where(eq(ingredients.id, sourceId))
    .returning({ icon: ingredients.icon });

  await tx
    .update(ingredients)
    .set({
      version: sql`${ingredients.version} + 1`,
      ...(keepFlag ? {} : { flagged: false, flagReason: null }),
      icon: sql`coalesce(${ingredients.icon}, ${gone?.icon ?? null})`,
    })
    .where(and(eq(ingredients.id, targetId), isNotNull(ingredients.householdId)));
}

/** The recipes with a line naming one of the food's spellings. */
function recipesNaming(food: string) {
  return qb
    .selectDistinct({ id: recipeIngredients.recipeId })
    .from(recipeIngredients)
    .innerJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
    )
    .where(rowsNaming(food).lineFoods);
}

/** How many spellings of an Ingredient the rows of a spelling of `householdId` (null: the seed's) may move to. */
export async function countAliasesOf(
  tx: DbTransaction,
  ingredientId: string,
  householdId: string | null
): Promise<number> {
  const [{ value } = { value: 0 }] = await tx
    .select({ value: count() })
    .from(ingredientAliases)
    .where(and(eq(ingredientAliases.ingredientId, ingredientId), spellingsSeenBy(householdId)));

  return value;
}

/**
 * A household's new Ingredient named for a spelling moved out to it, by a person or AI's split. Its
 * name is unique in the household, so one another of its Ingredients goes by throws a unique violation.
 */
export async function insertCatalogueIngredient(
  tx: DbTransaction,
  values: Pick<
    typeof ingredients.$inferInsert,
    "name" | "ownerId" | "flagged" | "flagReason" | "addedByHand" | "nameChosen" | "nameSettled"
  > & {
    householdId: string;
  }
): Promise<string> {
  const [row] = await tx.insert(ingredients).values(values).returning({ id: ingredients.id });

  return row!.id;
}

/** Two food names that are one name, case aside, as the unique name index reads them. */
export function sameFoodName(name: AnyPgColumn, other: AnyPgColumn | string): SQL {
  return eq(sql`lower(${name})`, sql`lower(${other})`);
}

/**
 * The household's (else the seed's; null: the seed's alone) food that goes by `name` in any case,
 * other than `exceptId`, locked.
 */
export async function lockIngredientNamed(
  tx: DbTransaction,
  householdId: string | null,
  name: string,
  exceptId?: string
): Promise<string | null> {
  const [row] = await tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(
        sameFoodName(ingredients.name, name),
        inCatalogue(ingredients.householdId, householdId),
        exceptId ? ne(ingredients.id, exceptId) : undefined
      )
    )
    .orderBy(ownBeforeSeed(ingredients.householdId))
    .limit(1)
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
  await lockPantryFood(tx, targetId);
  await repointKeyed(tx, PANTRY_KEYED, eq(pantryIngredients.ingredientAliasId, aliasId), targetId);
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
    .select({ householdId: pantryIngredients.householdId, userId: pantryIngredients.userId })
    .from(pantryIngredients)
    .where(eq(pantryIngredients.ingredientId, sourceId));

  for (const householdId of new Set(keepers.map((keeper) => keeper.householdId))) {
    await assertOwnReferences(householdId, partFoods(parts), tx);
  }
  for (const part of keepers.length > 0 ? parts : []) {
    await lockPantryFood(tx, part.ingredientId);
    await tx
      .insert(pantryIngredients)
      .values(
        keepers.map(({ householdId, userId }) => ({
          householdId,
          userId,
          ingredientId: part.ingredientId,
          ingredientAliasId: part.aliasId,
        }))
      )
      .onConflictDoNothing();
  }
  await tx.delete(ingredients).where(eq(ingredients.id, sourceId));
}

/** The foods and spellings parts name, for `assertOwnReferences`. */
function partFoods(parts: ReadonlyArray<{ aliasId: string | null; ingredientId: string | null }>) {
  return {
    ingredientIds: parts.map((part) => part.ingredientId),
    ingredientAliasIds: parts.map((part) => part.aliasId),
  };
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
  const named = new Map<string, GroceryPart[]>();
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
    named.set(row.householdId, [...(named.get(row.householdId) ?? []), first, ...rest]);
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
  for (const [householdId, parts] of named)
    await assertOwnReferences(householdId, partFoods(parts), tx);
}
