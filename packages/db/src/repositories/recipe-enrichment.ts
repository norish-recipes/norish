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

import type { EstimatedLineRow } from "@norish/db/schema";
import type { RecipeCategory } from "@norish/shared/contracts";
import type {
  NutritionGroupInput,
  ProvenanceGroupInput,
  RecipeEnrichmentWriteMode,
} from "@norish/shared/lib/recipe-enrichment";
import { db } from "@norish/db/drizzle";
import {
  recipeCuisines,
  recipeImages,
  recipeIngredients,
  recipeNutritionEstimates,
  recipes,
  stepIngredients,
  steps,
} from "@norish/db/schema";
import {
  fillProvenanceGaps,
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
 * The write mode decides how the write guards itself, because that is the
 * domain rule rather than a caller's choice: a gap-filling run defers to
 * Supplied Recipe Data, and a replacing run is a deliberate refresh.
 *
 * For a gap-filling run the absence check is part of the UPDATE itself, so if a
 * person supplied categories while the AI request was in flight this becomes a
 * successful no-op and the newer supplied data wins.
 *
 * @returns whether the replacement was applied
 */
export async function replaceRecipeCategories(
  recipeId: string,
  categories: readonly RecipeCategory[],
  mode: RecipeEnrichmentWriteMode
): Promise<boolean> {
  const validated = validateCategories(categories);
  const guards = [eq(recipes.id, recipeId)];

  if (mode === "gap-fill") guards.push(CATEGORIES_ABSENT);

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
 * As with categories, the write mode decides the guard. Only a complete stored
 * group is authoritative, so a gap-filling run applies while any of the four
 * fields is absent and defers only to a group that already has all of them.
 *
 * @returns whether the replacement was applied
 */
export async function replaceRecipeNutrition(
  recipeId: string,
  nutrition: NutritionGroupInput,
  mode: RecipeEnrichmentWriteMode
): Promise<boolean> {
  const group = validateNutrition(nutrition);
  const guards = [eq(recipes.id, recipeId)];

  if (mode === "gap-fill") guards.push(NUTRITION_INCOMPLETE);

  const updated = await db
    .update(recipes)
    .set({ ...group, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(and(...guards))
    .returning({ id: recipes.id });

  return updated.length > 0;
}

/**
 * Store the language model's estimate of the lines a recipe's worked-out
 * nutrition leaves out (ADR-0039): one per-serving share per line, under
 * the line's key, replacing any earlier estimate. Never the recipe's own
 * Nutrition Information. False where the recipe is gone.
 */
export async function saveRecipeNutritionEstimate(
  recipeId: string,
  estimate: { lines: EstimatedLineRow[] }
): Promise<boolean> {
  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.id, recipeId));

  if (!recipe) return false;

  await db
    .insert(recipeNutritionEstimates)
    .values({ recipeId, ...estimate, createdAt: new Date() })
    .onConflictDoUpdate({
      target: recipeNutritionEstimates.recipeId,
      set: { ...estimate, createdAt: new Date() },
    });

  return true;
}

/** Drop a recipe's stored estimate: every line counts now. Whether there was one. */
export async function clearRecipeNutritionEstimate(recipeId: string): Promise<boolean> {
  const removed = await db
    .delete(recipeNutritionEstimates)
    .where(eq(recipeNutritionEstimates.recipeId, recipeId))
    .returning({ recipeId: recipeNutritionEstimates.recipeId });

  return removed.length > 0;
}

/** What the Generated Image replacement did, and which files it orphaned. */
export interface GeneratedImageReplacement {
  /** The stored URL of the Generated Image just written, at order 0. */
  imageUrl: string;
  /**
   * URLs this recipe no longer references anywhere — not by a surviving
   * gallery row, not by the legacy scalar, and not as the image just
   * written. The repository holds no filesystem, so removing the files is
   * the caller's job.
   */
  replacedImageUrls: string[];
}

/**
 * Write a Generated Image into a recipe's primary slot (ADR-0025).
 *
 * Deliberately destructive, and the only place a Generated Image is written:
 * the row holding the primary slot — the first by order, whatever number
 * that is — is deleted, the new image is written at order 0 with the marker
 * set, and every other row keeps its contents and its relative order. Any
 * stray marked row is swept in the same transaction, so a recipe holds at
 * most one Generated Image and re-runs replace their own predecessor rather
 * than accumulating toward the gallery cap.
 *
 * The deprecated `recipes.image` scalar is cleared in the same transaction:
 * every reader resolves gallery-first, and a stale scalar would keep naming
 * a file this write may just have released.
 *
 * Eligibility is what keeps automatic runs off stored photographs; by the
 * time this runs, the coordinator has decided the slot may be consumed.
 *
 * @returns what was written and what was displaced, or null when the recipe
 *   does not exist.
 */
export async function replaceRecipePrimaryImageWithGenerated(
  recipeId: string,
  imageUrl: string
): Promise<GeneratedImageReplacement | null> {
  return await db.transaction(async (tx) => {
    const [recipe] = await tx
      .select({ id: recipes.id, image: recipes.image })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .for("update");

    if (!recipe) return null;

    const rows = await tx
      .select({
        id: recipeImages.id,
        image: recipeImages.image,
        order: recipeImages.order,
        generated: recipeImages.generated,
      })
      .from(recipeImages)
      .where(eq(recipeImages.recipeId, recipeId));

    rows.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    const primary = rows[0];
    const displaced = rows.filter((row) => row.id === primary?.id || row.generated);

    if (displaced.length > 0) {
      await tx.delete(recipeImages).where(
        inArray(
          recipeImages.id,
          displaced.map((row) => row.id)
        )
      );
    }

    await tx
      .insert(recipeImages)
      .values({ recipeId, image: imageUrl, order: "0", generated: true });

    await tx
      .update(recipes)
      .set({ image: null, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
      .where(eq(recipes.id, recipeId));

    // A file is released only when nothing on this recipe references it any
    // more: duplicate-content rows share a URL, and the legacy scalar often
    // names the same file as the displaced primary.
    const displacedIds = new Set(displaced.map((row) => row.id));
    const survivingUrls = new Set(
      rows.filter((row) => !displacedIds.has(row.id)).map((row) => row.image)
    );
    const previousScalar = (recipe.image ?? "").trim();
    const candidates = new Set(displaced.map((row) => row.image));

    if (previousScalar !== "") candidates.add(previousScalar);

    return {
      imageUrl,
      replacedImageUrls: [...candidates].filter(
        (candidate) => candidate !== imageUrl && !survivingUrls.has(candidate)
      ),
    };
  });
}

/** What one Recipe Provenance write proposes. Cuisines arrive already resolved. */
export interface ProvenanceReplacement extends ProvenanceGroupInput {
  /** Vocabulary row ids, resolved by the caller. Never names. */
  cuisineIds?: readonly string[];
}

/** One step's inferred Step Ingredients, in row-order space, system-agnostic. */
export interface StepIngredientLinkClaim {
  stepOrder: number;
  refs: readonly { ingredientOrder: number; share: number; order: number }[];
}

/** What one Step Ingredients write did. */
export interface StepIngredientWriteResult {
  /** Steps that received links. */
  filled: number;
  /** Steps whose existing links a replacing write removed first. */
  cleared: number;
}

/**
 * Write inferred Step Ingredients to a recipe's steps.
 *
 * A gap-filling write only ever adds links to steps that have none, so it can
 * never replace or remove what a person attached. That per-step check is the
 * suppression, at the only granularity where it is true, and it lives here so
 * no caller can write past it. Heading rows on either side are never linked.
 *
 * A replacing write clears the recipe's Step Ingredients — every step, not
 * only the ones the claim covers — and then writes the claim. Clearing the
 * whole recipe is the point rather than a side effect: a claim that correctly
 * omits a step is how a wrongly-linked step gets emptied, and per-step
 * clearing would preserve exactly the links a refresh exists to remove. It
 * cannot tell a link a person made from one an earlier run inferred, because
 * nothing records that, so it removes both. Reachable only from an
 * administrator's deliberate refresh.
 *
 * An empty claim writes nothing in either mode: a refresh that inferred
 * nothing is indistinguishable from one whose model had a bad day, and the
 * rest of this module refuses to let an empty proposal erase stored work.
 *
 * The claim is semantic — step orders and line orders, no system — and is
 * fanned out to every measurement system the recipe stores, matching rows by
 * order within each system. A reference whose line does not exist in some
 * system is dropped there rather than written wrong.
 */
export async function writeInferredStepIngredients(
  recipeId: string,
  links: readonly StepIngredientLinkClaim[],
  mode: RecipeEnrichmentWriteMode
): Promise<StepIngredientWriteResult> {
  if (links.length === 0) return { filled: 0, cleared: 0 };

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
        name: recipeIngredients.name,
      })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipeId));

    const stepIds = stepRows.map((row) => row.id);
    const linked =
      stepIds.length > 0
        ? (
            await tx
              .selectDistinct({ stepId: stepIngredients.stepId })
              .from(stepIngredients)
              .where(inArray(stepIngredients.stepId, stepIds))
          ).map((row) => row.stepId)
        : [];

    // Gap-filling treats an already-linked step as occupied and leaves it
    // alone; replacing empties them all first, so nothing is occupied by the
    // time the claim is written.
    const occupied = new Set<string>(mode === "gap-fill" ? linked : []);
    let cleared = 0;

    if (mode === "replace" && linked.length > 0) {
      await tx.delete(stepIngredients).where(inArray(stepIngredients.stepId, linked));
      cleared = linked.length;
    }

    const systems = [...new Set(stepRows.map((row) => row.systemUsed))];
    let filled = 0;

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
        filled += 1;
      }
    }

    return { filled, cleared };
  });
}

/**
 * Write a Recipe Provenance claim, atomically, with the write mode deciding
 * what "write" means (ADR-0018).
 *
 * A replacing run is a deliberate refresh: it replaces the whole group — the
 * scalar fields, the note, and the Cuisine join rows — in one transaction,
 * regardless of what is stored.
 *
 * A gap-filling run fills the group's gaps: it re-reads the stored group under
 * a row lock, keeps every supplied slot byte-for-byte, and writes only what is
 * absent, per {@link fillProvenanceGaps}. The in-transaction re-read is the
 * absence recheck that lets newer supplied data win a race with AI — a value a
 * person typed while the request was in flight is a supplied slot by the time
 * the write looks, so it is kept, and a group completed in flight defers the
 * whole claim.
 *
 * Either way the write is one transaction, so a failed Cuisine write leaves no
 * partial group behind.
 *
 * @returns whether anything was written
 */
export async function replaceRecipeProvenance(
  recipeId: string,
  provenance: ProvenanceReplacement,
  mode: RecipeEnrichmentWriteMode
): Promise<boolean> {
  const cuisineIds = [...new Set(provenance.cuisineIds ?? [])];

  if (cuisineIds.length === 0 && !hasSubstantiveProvenance(provenance)) {
    // An empty or failed inference must never erase stored provenance, so this
    // is a failure the worker retries rather than a silent write of nothing.
    throw new Error("Refusing to replace Recipe Provenance with an empty proposal");
  }

  if (mode === "gap-fill") {
    return await fillProvenanceGapsFromClaim(recipeId, provenance, cuisineIds);
  }

  const group = normalizeProvenanceGroup(provenance);

  return await db.transaction(async (tx) => {
    const updated = await tx
      .update(recipes)
      .set({ ...group, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
      .where(eq(recipes.id, recipeId))
      .returning({ id: recipes.id });

    if (updated.length === 0) return false;

    await replaceRecipeCuisinesTx(tx, recipeId, cuisineIds);

    return true;
  });
}

/**
 * The gap-filling write: merge the claim into the stored group's gaps.
 *
 * The row lock serializes this against every other writer of the recipe row —
 * an editor's save, a replacing run — so the merge always reads the group it is
 * about to complete, never a snapshot from before the race.
 */
async function fillProvenanceGapsFromClaim(
  recipeId: string,
  claim: ProvenanceReplacement,
  cuisineIds: readonly string[]
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const [stored] = await tx
      .select({
        originCountry: recipes.originCountry,
        originCountryName: recipes.originCountryName,
        originRegion: recipes.originRegion,
        provenanceNote: recipes.provenanceNote,
      })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .for("update");

    if (!stored) return false;

    const storedCuisines = await tx
      .select({ cuisineId: recipeCuisines.cuisineId })
      .from(recipeCuisines)
      .where(eq(recipeCuisines.recipeId, recipeId))
      .limit(1);

    const fill = fillProvenanceGaps(
      { ...stored, cuisines: storedCuisines.map((row) => row.cuisineId) },
      { ...claim, cuisines: cuisineIds }
    );

    if (!fill.changed) return false;

    await tx
      .update(recipes)
      .set({ ...fill.group, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
      .where(eq(recipes.id, recipeId));

    if (fill.fillCuisines) {
      await replaceRecipeCuisinesTx(tx, recipeId, cuisineIds);
    }

    return true;
  });
}
