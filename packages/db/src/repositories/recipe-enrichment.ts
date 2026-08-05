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

import { and, eq, inArray, sql } from "drizzle-orm";

import type { RecipeCategory } from "@norish/shared/contracts";
import type {
  NutritionGroupInput,
  ProvenanceGroupInput,
  RecipeEnrichmentOrigin,
} from "@norish/shared/lib/recipe-enrichment";
import { db } from "@norish/db/drizzle";
import {
  ingredients,
  recipeCuisines,
  recipeIngredients,
  recipes,
  stepIngredients,
  steps,
} from "@norish/db/schema";
import {
  hasSubstantiveCategories,
  hasSubstantiveNutrition,
  hasSubstantiveProvenance,
  normalizeNutritionGroup,
  normalizeProvenanceGroup,
} from "@norish/shared/lib/recipe-enrichment";

import { replaceRecipeCuisinesTx } from "./cuisines";

/**
 * SQL predicate for "this recipe has no substantive category".
 * Mirrors `hasSubstantiveCategories`: null, empty, and whitespace-only are absent.
 */
const CATEGORIES_ABSENT = sql`NOT EXISTS (
  SELECT 1 FROM unnest(${recipes.categories}) AS category WHERE btrim(category::text) <> ''
)`;

/**
 * SQL predicate for "this recipe's Nutrition Information group is incomplete".
 *
 * Mirrors `hasSubstantiveNutrition`: only a complete group — all four values
 * present — is authoritative. A partial group (an import that stated calories
 * alone) may be replaced wholesale by a complete estimate, so the four stored
 * values always agree with each other.
 */
const NUTRITION_INCOMPLETE = sql`(${recipes.calories} IS NULL
  OR ${recipes.fat} IS NULL
  OR ${recipes.carbs} IS NULL
  OR ${recipes.protein} IS NULL)`;

/**
 * SQL predicate for "this recipe's whole Recipe Provenance group is absent".
 *
 * Mirrors `hasSubstantiveProvenance`, including the Cuisine join: any single
 * substantive value — a country, a region, a note, or one Cuisine — makes the
 * stored group authoritative, so an automatic run defers to all of it.
 */
const PROVENANCE_ABSENT = sql`btrim(coalesce(${recipes.originCountry}, '')) = ''
  AND btrim(coalesce(${recipes.originRegion}, '')) = ''
  AND btrim(coalesce(${recipes.provenanceNote}, '')) = ''
  AND NOT EXISTS (
    SELECT 1 FROM ${recipeCuisines} WHERE ${recipeCuisines.recipeId} = ${recipes.id}
  )`;

function validateCategories(categories: readonly RecipeCategory[]): RecipeCategory[] {
  if (!hasSubstantiveCategories(categories)) {
    // An empty or invalid inference must never erase good stored values, so this
    // is a failure the worker retries rather than a silent write of nothing.
    throw new Error("Refusing to replace categories with an empty proposal");
  }

  return [...categories];
}

/**
 * Replace a recipe's complete category list.
 *
 * The origin decides how the write guards itself, because that is the domain
 * rule rather than a caller's choice: an automatic run defers to Supplied
 * Recipe Data, and a manual run is a deliberate refresh that replaces.
 *
 * For an automatic run the absence check is part of the UPDATE itself, so if a
 * person supplied categories while the AI request was in flight this becomes a
 * successful no-op and the newer supplied data wins.
 *
 * @returns whether the replacement was applied
 */
export async function replaceRecipeCategories(
  recipeId: string,
  categories: readonly RecipeCategory[],
  origin: RecipeEnrichmentOrigin
): Promise<boolean> {
  const validated = validateCategories(categories);
  const guards = [eq(recipes.id, recipeId)];

  if (origin === "automatic") guards.push(CATEGORIES_ABSENT);

  const updated = await db
    .update(recipes)
    .set({ categories: validated, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(and(...guards))
    .returning({ id: recipes.id });

  return updated.length > 0;
}

function validateNutrition(nutrition: NutritionGroupInput) {
  if (!hasSubstantiveNutrition(nutrition)) {
    // Replacement writes all four fields, so an incomplete proposal would null
    // out whatever it is missing. This is a failure the worker retries rather
    // than a silent write of gaps; zeros are values and pass.
    throw new Error("Refusing to replace Nutrition Information with an incomplete proposal");
  }

  return normalizeNutritionGroup(nutrition);
}

/**
 * Atomically replace all four Nutrition Information fields.
 *
 * As with categories, the origin decides the guard. Only a complete stored
 * group is authoritative, so an automatic run applies while any of the four
 * fields is absent and defers only to a group that already has all of them.
 *
 * @returns whether the replacement was applied
 */
export async function replaceRecipeNutrition(
  recipeId: string,
  nutrition: NutritionGroupInput,
  origin: RecipeEnrichmentOrigin
): Promise<boolean> {
  const group = validateNutrition(nutrition);
  const guards = [eq(recipes.id, recipeId)];

  if (origin === "automatic") guards.push(NUTRITION_INCOMPLETE);

  const updated = await db
    .update(recipes)
    .set({ ...group, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(and(...guards))
    .returning({ id: recipes.id });

  return updated.length > 0;
}

/** What one Recipe Provenance write proposes. Cuisines arrive already resolved. */
export interface ProvenanceReplacement extends ProvenanceGroupInput {
  /** Vocabulary row ids, resolved by the caller. Never names. */
  cuisineIds?: readonly string[];
}

/**
 * Atomically replace a recipe's whole Recipe Provenance group.
 *
 * The scalar fields, the note, and the Cuisine join rows go in one transaction,
 * so partial application is not possible and a failed write leaves no partial
 * group. As with the other replacement groups the origin decides the guard: an
 * automatic run applies only while the whole group is still absent, and a manual
 * run is a deliberate refresh that replaces regardless.
 *
 * @returns whether the replacement was applied
 */
/** One step's inferred Step Ingredients, in row-order space, system-agnostic. */
export interface StepIngredientLinkClaim {
  stepOrder: number;
  refs: readonly { ingredientOrder: number; share: number; order: number }[];
}

/**
 * Write inferred Step Ingredients to the recipe's bare steps.
 *
 * Ingredient Linking is a gap-filler in every case — automatic or manual, it
 * only ever adds links to steps that have none, so it can never replace or
 * remove what a person attached. That per-step check is the suppression, at
 * the only granularity where it is true, and it lives here so no caller can
 * write past it. Heading rows on either side are never linked.
 *
 * The claim is semantic — step orders and line orders, no system — and is
 * fanned out to every measurement system the recipe stores, matching rows by
 * order within each system. A reference whose line does not exist in some
 * system is dropped there rather than written wrong.
 *
 * @returns how many steps received links
 */
export async function addStepIngredientsToBareSteps(
  recipeId: string,
  links: readonly StepIngredientLinkClaim[]
): Promise<number> {
  if (links.length === 0) return 0;

  return await db.transaction(async (tx) => {
    const stepRows = await tx
      .select({ id: steps.id, order: steps.order, systemUsed: steps.systemUsed, step: steps.step })
      .from(steps)
      .where(eq(steps.recipeId, recipeId));
    const lineRows = await tx
      .select({
        id: recipeIngredients.id,
        order: recipeIngredients.order,
        systemUsed: recipeIngredients.systemUsed,
        name: ingredients.name,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
      .where(eq(recipeIngredients.recipeId, recipeId));

    const stepIds = stepRows.map((row) => row.id);
    const occupied = new Set<string>(
      stepIds.length > 0
        ? (
            await tx
              .selectDistinct({ stepId: stepIngredients.stepId })
              .from(stepIngredients)
              .where(inArray(stepIngredients.stepId, stepIds))
          ).map((row) => row.stepId)
        : []
    );

    const systems = [...new Set(stepRows.map((row) => row.systemUsed))];
    let written = 0;

    for (const system of systems) {
      const stepByOrder = new Map<number, (typeof stepRows)[number]>();

      for (const row of stepRows) {
        if (row.systemUsed !== system) continue;
        if (row.step.trim().startsWith("#")) continue;
        if (!stepByOrder.has(Number(row.order ?? 0))) stepByOrder.set(Number(row.order ?? 0), row);
      }

      const lineIdByOrder = new Map<number, string>();

      for (const row of lineRows) {
        if (row.systemUsed !== system) continue;
        if (row.name.trim().startsWith("#")) continue;
        if (!lineIdByOrder.has(Number(row.order ?? 0)))
          lineIdByOrder.set(Number(row.order ?? 0), row.id);
      }

      for (const claim of links) {
        const step = stepByOrder.get(claim.stepOrder);

        if (!step || occupied.has(step.id)) continue;

        const values = claim.refs.flatMap((ref) => {
          const recipeIngredientId = lineIdByOrder.get(ref.ingredientOrder);

          if (!recipeIngredientId) return [];

          return [
            {
              stepId: step.id,
              recipeIngredientId,
              share: String(ref.share),
              order: String(ref.order),
            },
          ];
        });

        if (values.length === 0) continue;

        await tx.insert(stepIngredients).values(values);
        written += 1;
      }
    }

    return written;
  });
}

export async function replaceRecipeProvenance(
  recipeId: string,
  provenance: ProvenanceReplacement,
  origin: RecipeEnrichmentOrigin
): Promise<boolean> {
  const cuisineIds = [...new Set(provenance.cuisineIds ?? [])];

  if (cuisineIds.length === 0 && !hasSubstantiveProvenance(provenance)) {
    // An empty or failed inference must never erase stored provenance, so this
    // is a failure the worker retries rather than a silent write of nothing.
    throw new Error("Refusing to replace Recipe Provenance with an empty proposal");
  }

  const group = normalizeProvenanceGroup(provenance);
  const guards = [eq(recipes.id, recipeId)];

  if (origin === "automatic") guards.push(PROVENANCE_ABSENT);

  return await db.transaction(async (tx) => {
    const updated = await tx
      .update(recipes)
      .set({ ...group, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
      .where(and(...guards))
      .returning({ id: recipes.id });

    if (updated.length === 0) return false;

    await replaceRecipeCuisinesTx(tx, recipeId, cuisineIds);

    return true;
  });
}
