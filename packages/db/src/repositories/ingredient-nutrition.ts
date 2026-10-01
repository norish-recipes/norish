import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import type { NutritionCodes } from "@norish/db/schema";
import { db } from "@norish/db/drizzle";
import {
  ingredientNutritionCorrections,
  ingredients,
  nutritionFoods,
  nutritionRules,
} from "@norish/db/schema";

/**
 * Ingredient Nutrition's reads and its one write (ADR-0039): the source
 * numbers the committed table carries, replaced whole when a release brings
 * a new version of it, and what the module reads to resolve an Ingredient's
 * numbers. Which number wins is the module's to say
 * (`@norish/shared-server/ingredients/nutrition`), not this file's.
 */

/** One dataset food as stored. */
export interface NutritionFoodRow {
  dataset: string;
  code: string;
  name: string;
  kcal: number;
  fat: number;
  carbs: number;
  protein: number;
  pieceWeight: number | null;
  density: number | null;
  ndb: string | null;
}

/** One of Norish's rules about a taxonomy entry. */
export interface NutritionRuleRow {
  offId: string;
  kind: string;
  food: string | null;
}

/** How many rows one insert carries: well under Postgres's parameter limit. */
const CHUNK = 1000;

/**
 * Replace every source food and rule with a table's, in one transaction: a
 * failure leaves the last good ones exactly as they were. Corrections live
 * elsewhere and are never touched.
 */
export async function replaceNutritionSources(
  foods: readonly NutritionFoodRow[],
  rules: readonly NutritionRuleRow[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(nutritionFoods);
    await tx.delete(nutritionRules);
    for (let start = 0; start < foods.length; start += CHUNK) {
      await tx.insert(nutritionFoods).values(foods.slice(start, start + CHUNK));
    }
    for (let start = 0; start < rules.length; start += CHUNK) {
      await tx.insert(nutritionRules).values(rules.slice(start, start + CHUNK));
    }
  });
}

/** An Ingredient as the module walks the tree: what it says about its nutrition, and its parent. */
export interface NutritionNode {
  id: string;
  name: string;
  parentId: string | null;
  offId: string | null;
  nutritionCodes: NutritionCodes | null;
}

/** How deep the tree is ever walked: a guard, since the tree has no cycle to loop on. */
const MAX_DEPTH = 64;

/** These Ingredients and every ancestor of each, by id. */
export async function findNutritionLineage(
  ids: readonly string[]
): Promise<Map<string, NutritionNode>> {
  const wanted = [...new Set(ids)];

  if (wanted.length === 0) return new Map();

  const result = await db.execute<{
    id: string;
    name: string;
    parent_id: string | null;
    off_id: string | null;
    nutrition_codes: NutritionCodes | null;
  }>(sql`
    with recursive lineage(id, depth) as (
      select i.id, 0 from ${ingredients} i
      where i.id = any(${sql.param(wanted)}::uuid[])
      union
      select p.id, lineage.depth + 1 from lineage
      join ${ingredients} c on c.id = lineage.id
      join ${ingredients} p on p.id = c.parent_id
      where lineage.depth < ${MAX_DEPTH}
    )
    select distinct i.id::text as id, i.name, i.parent_id::text as parent_id, i.off_id, i.nutrition_codes
    from lineage join ${ingredients} i on i.id = lineage.id`);

  return new Map(
    result.rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
        offId: row.off_id,
        nutritionCodes: row.nutrition_codes,
      },
    ])
  );
}

/** Norish's rules about these taxonomy entries. */
export async function findNutritionRules(offIds: readonly string[]): Promise<NutritionRuleRow[]> {
  const wanted = [...new Set(offIds)];

  if (wanted.length === 0) return [];

  return await db.select().from(nutritionRules).where(inArray(nutritionRules.offId, wanted));
}

/** Dataset foods by `dataset:code`, and USDA ones by NDB number, in one query however many. */
export async function findNutritionFoods(
  keys: readonly string[],
  ndbs: readonly string[] = []
): Promise<NutritionFoodRow[]> {
  const pairs = [...new Set(keys)].flatMap((key) => {
    const at = key.indexOf(":");

    return at > 0 ? [[key.slice(0, at), key.slice(at + 1)] as const] : [];
  });
  const wantedNdbs = [...new Set(ndbs)];

  if (pairs.length === 0 && wantedNdbs.length === 0) return [];

  return await db
    .select()
    .from(nutritionFoods)
    .where(
      or(
        sql`(${nutritionFoods.dataset}, ${nutritionFoods.code}) in (
          select * from unnest(${sql.param(pairs.map(([dataset]) => dataset))}::text[],
                               ${sql.param(pairs.map(([, code]) => code))}::text[]))`,
        wantedNdbs.length > 0
          ? and(eq(nutritionFoods.dataset, "usda"), inArray(nutritionFoods.ndb, wantedNdbs))
          : undefined
      )
    );
}

/**
 * Dataset foods whose names hold every word of a search, in the dataset's own
 * words ("milk semi skimmed uht"), for a household picking the food its
 * correction names. A few at most, shortest names first.
 */
export async function searchNutritionFoods(
  words: readonly string[],
  limit: number
): Promise<NutritionFoodRow[]> {
  if (words.length === 0) return [];

  return await db
    .select()
    .from(nutritionFoods)
    .where(and(...words.map((word) => sql`${nutritionFoods.name} ilike ${`%${word}%`}`)))
    .orderBy(sql`length(${nutritionFoods.name})`, nutritionFoods.dataset, nutritionFoods.code)
    .limit(limit);
}

/** A household's correction to one Ingredient, as stored. */
export type NutritionCorrectionRow = typeof ingredientNutritionCorrections.$inferSelect;

/** What a correction says, fact by fact: a dataset food (`dataset:code`), a number, or nothing. */
export interface NutritionCorrectionValues {
  numbersFood: string | null;
  kcal: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
  pieceWeightFood: string | null;
  pieceWeight: number | null;
  densityFood: string | null;
  density: number | null;
}

/**
 * The household's correction to each of these Ingredients: the most recent
 * any of its members made, whoever that was.
 */
export async function findHouseholdCorrections(
  ingredientIds: readonly string[],
  householdUserIds: readonly string[]
): Promise<Map<string, NutritionCorrectionRow>> {
  if (ingredientIds.length === 0 || householdUserIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(ingredientNutritionCorrections)
    .where(
      and(
        inArray(ingredientNutritionCorrections.ingredientId, [...new Set(ingredientIds)]),
        inArray(ingredientNutritionCorrections.userId, [...new Set(householdUserIds)])
      )
    )
    .orderBy(
      desc(ingredientNutritionCorrections.updatedAt),
      desc(ingredientNutritionCorrections.id)
    );
  const latest = new Map<string, NutritionCorrectionRow>();

  for (const row of rows) if (!latest.has(row.ingredientId)) latest.set(row.ingredientId, row);

  return latest;
}

/**
 * Write a member's correction to an Ingredient, replacing their own earlier
 * one: it becomes the household's, as the most recent. False where the
 * Ingredient is gone.
 */
export async function saveNutritionCorrection(
  userId: string,
  ingredientId: string,
  values: NutritionCorrectionValues
): Promise<boolean> {
  const [exists] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId));

  if (!exists) return false;

  const now = new Date();

  await db
    .insert(ingredientNutritionCorrections)
    .values({ userId, ingredientId, ...values, updatedAt: now })
    .onConflictDoUpdate({
      target: [ingredientNutritionCorrections.userId, ingredientNutritionCorrections.ingredientId],
      set: {
        ...values,
        updatedAt: now,
        version: sql`${ingredientNutritionCorrections.version} + 1`,
      },
    });

  return true;
}

/**
 * Remove a household's correction to an Ingredient, every member's, so the
 * sources' numbers are back for all of them. How many rows went.
 */
export async function removeHouseholdCorrections(
  ingredientId: string,
  householdUserIds: readonly string[]
): Promise<number> {
  if (householdUserIds.length === 0) return 0;

  const removed = await db
    .delete(ingredientNutritionCorrections)
    .where(
      and(
        eq(ingredientNutritionCorrections.ingredientId, ingredientId),
        inArray(ingredientNutritionCorrections.userId, [...householdUserIds])
      )
    )
    .returning({ id: ingredientNutritionCorrections.id });

  return removed.length;
}
