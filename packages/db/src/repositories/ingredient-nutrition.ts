import { and, eq, inArray, notExists, or, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { NutritionCodes } from "@norish/db/schema";
import { db } from "@norish/db/drizzle";
import {
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredientNutritionEstimates,
  ingredients,
  nutritionFoods,
  nutritionRules,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
} from "@norish/db/schema";
import { groupBy } from "@norish/shared/lib/group-by";

import type { RecipeListContext } from "./recipes";
import { isAnyOf } from "./array-params";
import { inCatalogue } from "./household-scope";
import { lineageCte } from "./ingredient-kinds";
import { isFirstLineFood } from "./ingredients";
import { buildPolicyCondition } from "./recipes";

const ownSystemLine = alias(recipeIngredients, "own");

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
  /** The other nutrients per 100 g, only those the dataset gives. */
  extras: Partial<Record<string, number>> | null;
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

/** Which of `ids` are the household's or the seed's foods: what a reader may ask about by id. */
export async function findIdsInCatalogue(
  householdId: string,
  ids: readonly string[]
): Promise<Set<string>> {
  const wanted = [...new Set(ids)];

  if (wanted.length === 0) return new Set();
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(inArray(ingredients.id, wanted), inCatalogue(ingredients.householdId, householdId)));

  return new Set(rows.map((row) => row.id));
}

/** These Ingredients and every ancestor of each, by id. */
export async function findNutritionLineage(
  ids: readonly string[]
): Promise<Map<string, NutritionNode>> {
  const wanted = [...new Set(ids)];

  if (wanted.length === 0) return new Map();

  const lineage = lineageCte(wanted);
  const rows = await db
    .with(lineage)
    .selectDistinct({
      id: ingredients.id,
      name: ingredients.name,
      parentId: ingredients.parentId,
      offId: ingredients.offId,
      nutritionCodes: ingredients.nutritionCodes,
    })
    .from(lineage)
    .innerJoin(ingredients, eq(ingredients.id, lineage.lineageId));

  return new Map(rows.map((row) => [row.id, row]));
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

  const codesOf = groupBy(
    pairs,
    ([dataset]) => dataset,
    ([, code]) => code
  );

  return await db
    .select()
    .from(nutritionFoods)
    .where(
      or(
        // One array of codes per dataset, so the (dataset, code) key finds them.
        ...[...codesOf].map(([dataset, codes]) =>
          and(eq(nutritionFoods.dataset, dataset), isAnyOf(nutritionFoods.code, codes, "text"))
        ),
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

/**
 * How many lines name this Ingredient by unit, in the recipes the viewer can open, read as each
 * worked-out total reads them (`nutritionLinesOf`): own measurement system, an "or" line's first.
 */
export async function countIngredientLinesByUnit(
  viewer: RecipeListContext,
  ingredientId: string
): Promise<Array<{ unit: string | null; lines: number }>> {
  if ((await findIdsInCatalogue(viewer.householdId, [ingredientId])).size === 0) return [];
  const visible = await buildPolicyCondition(viewer, recipes.householdId, "view");
  const rows = await db
    .select({ unit: recipeIngredients.unit, lines: sql<number>`count(*)::int` })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .innerJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
    )
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .where(
      and(
        eq(ingredientAliases.ingredientId, ingredientId),
        or(isFirstLineFood(), eq(recipeIngredients.joined, "together")),
        or(
          eq(recipeIngredients.systemUsed, recipes.systemUsed),
          notExists(
            new QueryBuilder()
              .select({ id: ownSystemLine.id })
              .from(ownSystemLine)
              .where(
                and(
                  eq(ownSystemLine.recipeId, recipes.id),
                  eq(ownSystemLine.systemUsed, recipes.systemUsed)
                )
              )
          )
        ),
        visible
      )
    )
    .groupBy(recipeIngredients.unit);

  return rows.map((row) => ({ unit: row.unit, lines: Number(row.lines) }));
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
  /** Other nutrients typed from the label beside the four, per 100 g. */
  extras?: Partial<Record<string, number>> | null;
  pieceWeightFood: string | null;
  pieceWeight: number | null;
  densityFood: string | null;
  density: number | null;
}

/** The household's correction to each of these Ingredients. */
export async function findHouseholdCorrections(
  ingredientIds: readonly string[],
  householdId: string
): Promise<Map<string, NutritionCorrectionRow>> {
  if (ingredientIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(ingredientNutritionCorrections)
    .where(
      and(
        inArray(ingredientNutritionCorrections.ingredientId, [...new Set(ingredientIds)]),
        eq(ingredientNutritionCorrections.householdId, householdId)
      )
    );

  return new Map(rows.map((row) => [row.ingredientId, row]));
}

/**
 * Write a member's correction to an Ingredient of the household's catalogue, replacing the
 * household's earlier one. False where the Ingredient is gone or another household's.
 */
export async function saveNutritionCorrection(
  householdId: string,
  userId: string,
  ingredientId: string,
  values: NutritionCorrectionValues
): Promise<boolean> {
  const [exists] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(eq(ingredients.id, ingredientId), inCatalogue(ingredients.householdId, householdId))
    );

  if (!exists) return false;

  const now = new Date();

  await db
    .insert(ingredientNutritionCorrections)
    .values({ householdId, userId, ingredientId, ...values, updatedAt: now })
    .onConflictDoUpdate({
      target: [
        ingredientNutritionCorrections.householdId,
        ingredientNutritionCorrections.ingredientId,
      ],
      set: {
        ...values,
        userId,
        updatedAt: now,
        version: sql`${ingredientNutritionCorrections.version} + 1`,
      },
    });

  return true;
}

/**
 * Remove a household's correction to an Ingredient, so the sources' numbers
 * are back for all of it. How many rows went.
 */
export async function removeHouseholdCorrections(
  ingredientId: string,
  householdId: string
): Promise<number> {
  const removed = await db
    .delete(ingredientNutritionCorrections)
    .where(
      and(
        eq(ingredientNutritionCorrections.ingredientId, ingredientId),
        eq(ingredientNutritionCorrections.householdId, householdId)
      )
    )
    .returning({ id: ingredientNutritionCorrections.id });

  return removed.length;
}

/** AI's estimate of an Ingredient's missing facts, as stored. */
export type NutritionEstimateRow = typeof ingredientNutritionEstimates.$inferSelect;

/** What one estimate writes: only the facts AI was asked for. */
export type NutritionEstimateValues = Partial<
  Pick<
    NutritionEstimateRow,
    "kcal" | "fat" | "carbs" | "protein" | "pieceWeight" | "pieceless" | "density"
  >
>;

/** AI's estimates for these Ingredients, by id. */
export async function findNutritionEstimates(
  ingredientIds: readonly string[]
): Promise<Map<string, NutritionEstimateRow>> {
  if (ingredientIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(ingredientNutritionEstimates)
    .where(inArray(ingredientNutritionEstimates.ingredientId, [...new Set(ingredientIds)]));

  return new Map(rows.map((row) => [row.ingredientId, row]));
}

/**
 * Write AI's estimate of an Ingredient's facts, keeping any fact an earlier estimate gave that
 * this one does not name. False where the Ingredient is gone.
 */
export async function saveNutritionEstimate(
  ingredientId: string,
  values: NutritionEstimateValues
): Promise<boolean> {
  const [exists] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId));

  if (!exists) return false;

  await db
    .insert(ingredientNutritionEstimates)
    .values({ ingredientId, ...values })
    .onConflictDoUpdate({
      target: ingredientNutritionEstimates.ingredientId,
      set: {
        ...values,
        updatedAt: new Date(),
        version: sql`${ingredientNutritionEstimates.version} + 1`,
      },
    });

  return true;
}
