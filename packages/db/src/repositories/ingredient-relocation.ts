import type { SQL } from "drizzle-orm";
import { and, asc, count, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import { db, holdLock } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  ingredientAIChanges,
  ingredientAliases,
  ingredientJunkPile,
  ingredientNutritionCorrections,
  ingredientNutritionEstimates,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
  recurringGroceries,
  storeProductLinks,
} from "@norish/db/schema";
import { distinctFoods, joinOf } from "@norish/shared/lib/line-foods";

import { isAnyOf, pickedByKey } from "./array-params";
import { assertOwnReferences } from "./household-rows";
import { inCatalogue, ownBeforeSeed } from "./household-scope";
import { moveMergedAIChanges } from "./ingredient-ai-changes";
import { rowsNaming, spellingsSeenBy } from "./ingredient-catalogue";
import { ancestryCte } from "./ingredient-kinds";
import { writeRecipeLineFoodsTx } from "./ingredients";
import { lockPantryFood } from "./pantry";
import { defaultOf } from "./raw-sql";
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
async function mergeLockedFoods(
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

/**
 * After a leave (ADR-0042): no line of the household's recipes names another household's food or
 * spelling. Each such food is copied (name, flags, icon file, AI estimate; its parent where seeded or
 * copied too) with the spellings the lines use, a spelling on a seeded food becomes the household's,
 * and the lines and their AI shares follow. The old rows are held against a change until the commit.
 */
export async function homeRecipeFoodsTx(tx: DbTransaction, householdId: string): Promise<void> {
  const homeLines = qb
    .select({ id: recipeIngredients.id })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .where(eq(recipes.householdId, householdId));
  const foreign = (column: typeof ingredients.householdId | typeof ingredientAliases.householdId) =>
    and(isNotNull(column), ne(column, householdId));
  const used = await tx
    .selectDistinct({ id: ingredientAliases.id, foodId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .innerJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.ingredientAliasId, ingredientAliases.id)
    )
    .where(
      and(
        inArray(recipeIngredientFoods.recipeIngredientId, homeLines),
        foreign(ingredientAliases.householdId)
      )
    );

  if (used.length === 0) return;
  // Foods before spellings, as a deletion takes them: a rename, merge or delete waits for the move.
  const copied = (
    await tx
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(
        and(
          isAnyOf(
            ingredients.id,
            used.map((row) => row.foodId),
            "uuid"
          ),
          foreign(ingredients.householdId)
        )
      )
      .orderBy(ingredients.id)
      .for("share")
  ).map((row) => row.id);
  const spellingIds = (
    await tx
      .select({ id: ingredientAliases.id })
      .from(ingredientAliases)
      .where(
        isAnyOf(
          ingredientAliases.id,
          used.map((row) => row.id),
          "uuid"
        )
      )
      .orderBy(ingredientAliases.id)
      .for("share")
  ).map((row) => row.id);
  const old = alias(ingredients, "old_food");
  const copy = alias(ingredients, "home_food");
  const sameName = and(
    eq(copy.householdId, householdId),
    eq(sql`lower(${copy.name})`, sql`lower(${old.name})`)
  );
  const made = await tx
    .insert(ingredients)
    .select(
      qb
        .select({
          id: defaultOf(ingredients.id),
          householdId: sql<string>`${householdId}::uuid`.as(ingredients.householdId.name),
          name: old.name,
          ownerId: sql<string | null>`null`.as(ingredients.ownerId.name),
          addedByHand: old.addedByHand,
          flagged: old.flagged,
          flagReason: old.flagReason,
          keptDistinct: old.keptDistinct,
          parentId: sql<string | null>`null::uuid`.as(ingredients.parentId.name),
          parentChosen: old.parentChosen,
          offId: old.offId,
          nutritionCodes: old.nutritionCodes,
          icon: old.icon,
          nameSettled: old.nameSettled,
          nameChosen: old.nameChosen,
          unusedSince: sql<Date | null>`null::timestamptz`.as(ingredients.unusedSince.name),
          createdAt: defaultOf(ingredients.createdAt),
          version: defaultOf(ingredients.version),
        })
        .from(old)
        .where(isAnyOf(old.id, copied, "uuid"))
    )
    .onConflictDoNothing()
    .returning({ id: ingredients.id });
  const madeIds = made.map((row) => row.id);
  const homeOf = new Map(
    (
      await tx
        .select({ from: old.id, to: copy.id })
        .from(old)
        .innerJoin(copy, sameName)
        .where(isAnyOf(old.id, copied, "uuid"))
    ).map((row) => [row.from, row.to])
  );
  const parent = alias(ingredients, "old_parent");
  const parentCopy = alias(ingredients, "home_parent");

  // A seeded parent stays; an own one only as its copy, where the lines use it too.
  await tx
    .update(copy)
    .set({ parentId: sql`${old.parentId}` })
    .from(old)
    .innerJoin(parent, eq(parent.id, old.parentId))
    .where(and(sameName, isAnyOf(copy.id, madeIds, "uuid"), isNull(parent.householdId)));
  await tx
    .update(copy)
    .set({ parentId: sql`${parentCopy.id}` })
    .from(old)
    .innerJoin(parent, eq(parent.id, old.parentId))
    .innerJoin(
      parentCopy,
      and(
        eq(parentCopy.householdId, householdId),
        eq(sql`lower(${parentCopy.name})`, sql`lower(${parent.name})`)
      )
    )
    .where(and(sameName, isAnyOf(copy.id, madeIds, "uuid"), isAnyOf(parent.id, copied, "uuid")));
  await tx
    .insert(ingredientNutritionEstimates)
    .select(
      qb
        .select({
          ingredientId: sql<string>`${copy.id}`.as(ingredientNutritionEstimates.ingredientId.name),
          kcal: ingredientNutritionEstimates.kcal,
          fat: ingredientNutritionEstimates.fat,
          carbs: ingredientNutritionEstimates.carbs,
          protein: ingredientNutritionEstimates.protein,
          pieceWeight: ingredientNutritionEstimates.pieceWeight,
          pieceless: ingredientNutritionEstimates.pieceless,
          density: ingredientNutritionEstimates.density,
          createdAt: ingredientNutritionEstimates.createdAt,
          updatedAt: ingredientNutritionEstimates.updatedAt,
          version: ingredientNutritionEstimates.version,
        })
        .from(ingredientNutritionEstimates)
        .innerJoin(old, eq(old.id, ingredientNutritionEstimates.ingredientId))
        .innerJoin(copy, sameName)
        .where(isAnyOf(copy.id, madeIds, "uuid"))
    )
    .onConflictDoNothing();

  const spelling = alias(ingredientAliases, "old_spelling");
  const homeSpelling = alias(ingredientAliases, "home_spelling");
  const spellingRow = (ingredientId: SQL) => ({
    id: defaultOf(ingredientAliases.id),
    householdId: sql<string>`${householdId}::uuid`.as(ingredientAliases.householdId.name),
    text: spelling.text,
    fold: spelling.fold,
    locale: spelling.locale,
    ingredientId: sql<string>`${ingredientId}`.as(ingredientAliases.ingredientId.name),
    ownerId: sql<string | null>`null`.as(ingredientAliases.ownerId.name),
    seeded: defaultOf(ingredientAliases.seeded),
    createdAt: defaultOf(ingredientAliases.createdAt),
    updatedAt: defaultOf(ingredientAliases.updatedAt),
    version: defaultOf(ingredientAliases.version),
  });

  // A spelling on a seeded food stays on it, as the household's; one on an own food goes to the copy.
  await tx
    .insert(ingredientAliases)
    .select(
      qb
        .select(spellingRow(sql`${spelling.ingredientId}`))
        .from(spelling)
        .innerJoin(old, eq(old.id, spelling.ingredientId))
        .where(and(isAnyOf(spelling.id, spellingIds, "uuid"), isNull(old.householdId)))
    )
    .onConflictDoNothing();
  await tx
    .insert(ingredientAliases)
    .select(
      qb
        .select(spellingRow(sql`${copy.id}`))
        .from(spelling)
        .innerJoin(old, eq(old.id, spelling.ingredientId))
        .innerJoin(copy, sameName)
        .where(isAnyOf(spelling.id, spellingIds, "uuid"))
    )
    .onConflictDoNothing();
  await tx
    .update(recipeIngredientFoods)
    .set({ ingredientAliasId: sql`${homeSpelling.id}` })
    .from(spelling)
    .innerJoin(
      homeSpelling,
      and(eq(homeSpelling.householdId, householdId), eq(homeSpelling.fold, spelling.fold))
    )
    .where(
      and(
        eq(recipeIngredientFoods.ingredientAliasId, spelling.id),
        isAnyOf(spelling.id, spellingIds, "uuid"),
        inArray(recipeIngredientFoods.recipeIngredientId, homeLines)
      )
    );
  await rekeyNutritionSharesTx(
    tx,
    qb.select({ id: recipes.id }).from(recipes).where(eq(recipes.householdId, householdId)),
    homeOf
  );
}

/**
 * A household of one's catalogue joins `into` (ADR-0042), after its rows moved: an own food `into`
 * has by name, else by a spelling, merges into that one (the same name first); a spelling both hold
 * gives its rows to `into`'s; a junk mark both hold stays `into`'s; the rest moves as it is.
 */
export async function mergeCatalogueIntoTx(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<void> {
  const joinerFood = alias(ingredients, "joiner_food");
  const householdFood = alias(ingredients, "household_food");
  const joinerSpelling = alias(ingredientAliases, "joiner_spelling");
  const householdSpelling = alias(ingredientAliases, "household_spelling");
  const sharedFold = and(
    eq(householdSpelling.householdId, into),
    eq(householdSpelling.fold, joinerSpelling.fold)
  );
  const byName = await tx
    .select({ from: joinerFood.id, to: householdFood.id })
    .from(joinerFood)
    .innerJoin(
      householdFood,
      and(
        eq(householdFood.householdId, into),
        eq(sql`lower(${householdFood.name})`, sql`lower(${joinerFood.name})`)
      )
    )
    .where(eq(joinerFood.householdId, from));
  const bySpelling = await tx
    .select({ from: joinerFood.id, to: householdSpelling.ingredientId })
    .from(joinerSpelling)
    .innerJoin(householdSpelling, sharedFold)
    .innerJoin(joinerFood, eq(joinerFood.id, joinerSpelling.ingredientId))
    .where(and(eq(joinerSpelling.householdId, from), eq(joinerFood.householdId, from)))
    .orderBy(joinerSpelling.fold);
  const targets = new Map<string, string>();

  for (const pair of [...byName, ...bySpelling]) {
    if (!targets.has(pair.from)) targets.set(pair.from, pair.to);
  }
  // ponytail: one merge per colliding food, each set-based over its rows; batch them if joins slow.
  for (const [source, target] of targets) {
    if (await lockFoods(tx, [source, target])) {
      await mergeLockedFoods(tx, source, target, { keepFlag: true });
    }
  }

  // `into`'s spellings of those folds are held against a delete until the join commits.
  const shared = await tx
    .select({
      id: joinerSpelling.id,
      food: joinerSpelling.ingredientId,
      householdsFood: householdSpelling.ingredientId,
    })
    .from(joinerSpelling)
    .innerJoin(householdSpelling, sharedFold)
    .where(eq(joinerSpelling.householdId, from))
    .orderBy(householdSpelling.id)
    .for("key share", { of: householdSpelling });

  if (shared.length > 0) await giveSpellingRowsTo(tx, into, shared);

  const theirJunk = qb
    .select({ fold: ingredientJunkPile.fold })
    .from(ingredientJunkPile)
    .where(eq(ingredientJunkPile.householdId, into));

  await tx
    .delete(ingredientJunkPile)
    .where(
      and(eq(ingredientJunkPile.householdId, from), inArray(ingredientJunkPile.fold, theirJunk))
    );
  for (const table of [ingredients, ingredientAliases, ingredientJunkPile, ingredientAIChanges]) {
    await tx.update(table).set({ householdId: into }).where(eq(table.householdId, from));
  }
}

/** Points every row naming one of the joiner's `shared` spellings at `into`'s of its fold, then
 * deletes the joiner's; the AI's shares follow a line whose food changed. */
async function giveSpellingRowsTo(
  tx: DbTransaction,
  into: string,
  shared: ReadonlyArray<{ id: string; food: string; householdsFood: string }>
): Promise<void> {
  const ids = shared.map((row) => row.id);
  const joinerSpelling = alias(ingredientAliases, "joiner_spelling");
  const householdSpelling = alias(ingredientAliases, "household_spelling");
  const pair = and(
    isAnyOf(joinerSpelling.id, ids, "uuid"),
    eq(householdSpelling.householdId, into),
    eq(householdSpelling.fold, joinerSpelling.fold)
  );
  const foods = new Map<string, string>();

  for (const row of shared) {
    if (row.food !== row.householdsFood && !foods.has(row.food)) {
      foods.set(row.food, row.householdsFood);
    }
  }
  await rekeyNutritionSharesTx(
    tx,
    qb
      .selectDistinct({ id: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .innerJoin(
        recipeIngredientFoods,
        eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
      )
      .where(isAnyOf(recipeIngredientFoods.ingredientAliasId, ids, "uuid")),
    foods
  );
  await tx
    .update(recipeIngredientFoods)
    .set({ ingredientAliasId: sql`${householdSpelling.id}` })
    .from(joinerSpelling)
    .innerJoin(householdSpelling, pair)
    .where(eq(recipeIngredientFoods.ingredientAliasId, joinerSpelling.id));
  for (const table of [groceries, recurringGroceries]) {
    await tx
      .update(table)
      .set({
        ingredientAliasId: sql`${householdSpelling.id}`,
        ingredientId: sql`${householdSpelling.ingredientId}`,
      })
      .from(joinerSpelling)
      .innerJoin(householdSpelling, pair)
      .where(eq(table.ingredientAliasId, joinerSpelling.id));
  }

  // A Pantry row whose food the household's Pantry already holds goes; the rest names that food.
  const pantry = await tx
    .select({
      id: pantryIngredients.id,
      aliasId: pantryIngredients.ingredientAliasId,
      ingredientId: pantryIngredients.ingredientId,
    })
    .from(pantryIngredients)
    .where(eq(pantryIngredients.householdId, into))
    .orderBy(pantryIngredients.id);
  const sharedById = new Map(shared.map((row) => [row.id, row]));
  const held = new Set(
    pantry.flatMap((row) => (row.aliasId && sharedById.has(row.aliasId) ? [] : [row.ingredientId]))
  );
  const dropped: string[] = [];
  const kept: Array<{ id: string; aliasId: string; ingredientId: string }> = [];
  const spellingOf = new Map(
    (
      await tx
        .select({ from: joinerSpelling.id, to: householdSpelling.id })
        .from(joinerSpelling)
        .innerJoin(householdSpelling, pair)
    ).map((row) => [row.from, row.to])
  );

  for (const row of pantry) {
    const moved = row.aliasId ? sharedById.get(row.aliasId) : undefined;

    if (!moved) continue;
    if (held.has(moved.householdsFood)) {
      dropped.push(row.id);
      continue;
    }
    held.add(moved.householdsFood);
    kept.push({
      id: row.id,
      aliasId: spellingOf.get(moved.id)!,
      ingredientId: moved.householdsFood,
    });
  }
  if (dropped.length > 0) {
    await tx.delete(pantryIngredients).where(isAnyOf(pantryIngredients.id, dropped, "uuid"));
  }
  if (kept.length > 0) {
    const keptIds = kept.map((row) => row.id);

    await tx
      .update(pantryIngredients)
      .set({
        ingredientAliasId: sql`${pickedByKey(
          pantryIngredients.id,
          keptIds,
          "uuid",
          kept.map((row) => row.aliasId)
        )}::uuid`,
        ingredientId: sql`${pickedByKey(
          pantryIngredients.id,
          keptIds,
          "uuid",
          kept.map((row) => row.ingredientId)
        )}::uuid`,
      })
      .where(isAnyOf(pantryIngredients.id, keptIds, "uuid"));
  }
  await tx.delete(ingredientAliases).where(isAnyOf(ingredientAliases.id, ids, "uuid"));
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
        eq(sql`lower(${ingredients.name})`, sql`lower(${name})`),
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
