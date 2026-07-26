/**
 * Recipe Enrichment persistence.
 *
 * The destructive write semantics live here rather than in workers or routers,
 * so no caller can accidentally implement "replace" where "append" was meant or
 * skip the absence recheck that lets newer supplied data win a race with AI.
 *
 * Tag and allergy appends live in the tags repository, next to the tag helpers
 * they share; this module owns the two replacement groups.
 */

import { and, eq, sql } from "drizzle-orm";

import type { RecipeCategory } from "@norish/shared/contracts";
import type { NutritionGroupInput } from "@norish/shared/lib/recipe-enrichment";
import { db } from "@norish/db/drizzle";
import { recipes } from "@norish/db/schema";
import {
  hasSubstantiveCategories,
  hasSubstantiveNutrition,
  normalizeNutritionGroup,
} from "@norish/shared/lib/recipe-enrichment";

/**
 * SQL predicate for "this recipe has no substantive category".
 * Mirrors `hasSubstantiveCategories`: null, empty, and whitespace-only are absent.
 */
const CATEGORIES_ABSENT = sql`NOT EXISTS (
  SELECT 1 FROM unnest(${recipes.categories}) AS category WHERE btrim(category::text) <> ''
)`;

/**
 * SQL predicate for "this recipe's whole Nutrition Information group is absent".
 * Any single substantive value makes the stored group authoritative.
 */
const NUTRITION_ABSENT = sql`${recipes.calories} IS NULL
  AND ${recipes.fat} IS NULL
  AND ${recipes.carbs} IS NULL
  AND ${recipes.protein} IS NULL`;

function validateCategories(categories: readonly RecipeCategory[]): RecipeCategory[] {
  if (!hasSubstantiveCategories(categories)) {
    // An empty or invalid inference must never erase good stored values, so this
    // is a failure the worker retries rather than a silent write of nothing.
    throw new Error("Refusing to replace categories with an empty proposal");
  }

  return [...categories];
}

/**
 * Replace a recipe's complete category list. Manual replacement is intentional
 * and unconditional once the proposal validates.
 *
 * @returns whether a row was updated (false only when the recipe is gone)
 */
export async function replaceRecipeCategories(
  recipeId: string,
  categories: readonly RecipeCategory[]
): Promise<boolean> {
  const validated = validateCategories(categories);

  const updated = await db
    .update(recipes)
    .set({ categories: validated, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(eq(recipes.id, recipeId))
    .returning({ id: recipes.id });

  return updated.length > 0;
}

/**
 * Replace a recipe's category list only while it is still empty.
 *
 * The absence check is part of the write itself: if a person supplied categories
 * while the AI request was in flight, this becomes a successful no-op and the
 * newer supplied data wins.
 *
 * @returns whether the replacement was applied
 */
export async function replaceRecipeCategoriesIfAbsent(
  recipeId: string,
  categories: readonly RecipeCategory[]
): Promise<boolean> {
  const validated = validateCategories(categories);

  const updated = await db
    .update(recipes)
    .set({ categories: validated, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(and(eq(recipes.id, recipeId), CATEGORIES_ABSENT))
    .returning({ id: recipes.id });

  return updated.length > 0;
}

function validateNutrition(nutrition: NutritionGroupInput) {
  if (!hasSubstantiveNutrition(nutrition)) {
    throw new Error("Refusing to replace Nutrition Information with an empty proposal");
  }

  // Replacement cannot mix an old estimate with a new one, so omitted fields
  // are normalized to null and written along with the substantive ones.
  return normalizeNutritionGroup(nutrition);
}

/**
 * Atomically replace all four Nutrition Information fields.
 *
 * @returns whether a row was updated (false only when the recipe is gone)
 */
export async function replaceRecipeNutrition(
  recipeId: string,
  nutrition: NutritionGroupInput
): Promise<boolean> {
  const group = validateNutrition(nutrition);

  const updated = await db
    .update(recipes)
    .set({ ...group, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(eq(recipes.id, recipeId))
    .returning({ id: recipes.id });

  return updated.length > 0;
}

/**
 * Atomically replace all four Nutrition Information fields, but only while the
 * whole group is still absent. Partial supplied nutrition therefore survives.
 *
 * @returns whether the replacement was applied
 */
export async function replaceRecipeNutritionIfAbsent(
  recipeId: string,
  nutrition: NutritionGroupInput
): Promise<boolean> {
  const group = validateNutrition(nutrition);

  const updated = await db
    .update(recipes)
    .set({ ...group, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(and(eq(recipes.id, recipeId), NUTRITION_ABSENT))
    .returning({ id: recipes.id });

  return updated.length > 0;
}
