import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { StepIngredientInputDto } from "@norish/shared/contracts/dto/step-ingredients";
import type { StepDto, StepInsertDto } from "@norish/shared/contracts/dto/steps";
import { db } from "@norish/db/drizzle";
import { dbLogger } from "@norish/db/logger";
import { recipeIngredients, stepImages, stepIngredients, steps } from "@norish/db/schema";
import { StepSelectBaseSchema } from "@norish/shared/contracts/zod/steps";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

const StepArraySchema = z.array(StepSelectBaseSchema);

export type StepInsertWithImages = StepInsertDto & {
  images?: { image: string; order: number }[];
  stepIngredients?: StepIngredientInputDto[];
};

/**
 * Map a recipe's ingredient lines from their `order` to their row id, per
 * measurement system. Step Ingredient references travel by line order (line
 * rows are minted inside the same transaction, so a payload cannot know row
 * ids); this is where they land on the real rows so the stored form is a
 * foreign key and deletes cascade.
 */
export async function loadIngredientLineIdsByOrderTx(
  tx: any,
  recipeId: string,
  systemUsed: "metric" | "us"
): Promise<Map<number, string>> {
  const rows: Array<{ id: string; order: string | number | null }> = await tx
    .select({ id: recipeIngredients.id, order: recipeIngredients.order })
    .from(recipeIngredients)
    .where(
      and(eq(recipeIngredients.recipeId, recipeId), eq(recipeIngredients.systemUsed, systemUsed))
    );
  const byOrder = new Map<number, string>();

  for (const row of rows) {
    const order = Number(row.order ?? 0);

    if (!byOrder.has(order)) byOrder.set(order, row.id);
  }

  return byOrder;
}

/**
 * Replace one step's Step Ingredients from its payload references.
 *
 * Replacement is wholesale: the references are value objects with no children,
 * so nothing is lost by rewriting them, and a reference whose line order no
 * longer resolves is dropped rather than written wrong.
 */
export async function syncStepIngredientsTx(
  tx: any,
  stepId: string,
  refs: readonly StepIngredientInputDto[],
  lineIdByOrder: ReadonlyMap<number, string>
): Promise<void> {
  await tx.delete(stepIngredients).where(eq(stepIngredients.stepId, stepId));

  const values = refs.flatMap((ref, index) => {
    const recipeIngredientId = lineIdByOrder.get(Number(ref.ingredientOrder));

    if (!recipeIngredientId) return [];

    return [
      {
        stepId,
        recipeIngredientId,
        share: String(ref.share ?? 1),
        order: String(ref.order ?? index),
      },
    ];
  });

  if (values.length > 0) {
    await tx.insert(stepIngredients).values(values);
  }
}

function stepIdentityKey(step: {
  recipeId: string;
  systemUsed: string;
  step: string;
  order?: unknown;
}) {
  const order = Number(step.order ?? 0);

  return `${step.recipeId}-${step.systemUsed}-${order}-${step.step.toLowerCase().trim()}`;
}

export async function createManyRecipeStepsTx(
  tx: any,
  rawSteps: StepInsertWithImages[]
): Promise<StepDto[]> {
  if (!rawSteps.length) return [];

  const cleaned = rawSteps
    .map((s, index) => ({
      ...s,
      systemUsed: s.systemUsed ?? "metric",
      order: s.order ?? index,
      step: stripHtmlTags(s.step),
    }))
    .filter((s) => s.step.length > 0 && s.recipeId);

  if (cleaned.length === 0) return [];

  const seen = new Set<string>();
  const unique = cleaned.filter((s) => {
    const key = stepIdentityKey(s);

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });

  const recipeIds = Array.from(new Set(unique.map((s) => s.recipeId)));
  const existingRows: Array<typeof steps.$inferSelect> = [];

  for (const recipeId of recipeIds) {
    const subset = unique.filter((s) => s.recipeId === recipeId);
    const stepTexts = Array.from(new Set(subset.map((s) => s.step)));
    const systems = Array.from(new Set(subset.map((s) => s.systemUsed)));

    if (stepTexts.length === 0 || systems.length === 0) continue;

    const rows = await tx
      .select()
      .from(steps)
      .where(
        and(
          eq(steps.recipeId, recipeId),
          inArray(steps.step, stepTexts),
          inArray(steps.systemUsed, systems)
        )
      );

    existingRows.push(...rows);
  }

  const existingKeys = new Set(existingRows.map(stepIdentityKey));
  const stepsToInsert = unique
    .filter((step) => !existingKeys.has(stepIdentityKey(step)))
    .map(({ images: _images, ...step }) => step);

  if (stepsToInsert.length > 0) {
    await tx.insert(steps).values(stepsToInsert);
  }

  const allSteps: StepDto[] = [];

  // Map to track step text and images for insertion
  const stepImagesMap = new Map<string, { image: string; order: number }[]>();
  const stepIngredientRefsMap = new Map<string, StepIngredientInputDto[]>();

  for (const s of unique) {
    if (s.images && s.images.length > 0) {
      stepImagesMap.set(stepIdentityKey(s), s.images);
    }

    if (s.stepIngredients && s.stepIngredients.length > 0) {
      stepIngredientRefsMap.set(stepIdentityKey(s), s.stepIngredients);
    }
  }

  for (const recipeId of recipeIds) {
    const subset = unique.filter((s) => s.recipeId === recipeId);
    const subsetKeys = new Set(subset.map(stepIdentityKey));
    const stepTexts = Array.from(new Set(subset.map((s) => s.step)));
    const systems = Array.from(new Set(subset.map((s) => s.systemUsed)));
    const rows = (
      await tx
        .select()
        .from(steps)
        .where(
          and(
            eq(steps.recipeId, recipeId),
            inArray(steps.step, stepTexts),
            inArray(steps.systemUsed, systems)
          )
        )
    ).filter((row: typeof steps.$inferSelect) => subsetKeys.has(stepIdentityKey(row)));

    const parsed = StepArraySchema.safeParse(rows);

    if (!parsed.success) {
      dbLogger.error({ err: parsed.error }, "Failed to parse steps");
      throw new Error(`Failed to parse steps after insert for recipe ${recipeId}`);
    }

    // Ingredient lines are attached before steps in every creation flow, so
    // the payload's by-order references can land on real rows here. Loaded
    // once per system actually referenced.
    const lineIdsBySystem = new Map<string, Map<number, string>>();

    // Insert step images and Step Ingredients
    for (const stepRow of rows) {
      const images = stepImagesMap.get(stepIdentityKey(stepRow));

      if (images && images.length > 0) {
        const imagesToInsert = images.map((img) => ({
          stepId: stepRow.id,
          image: img.image,
          order: img.order.toString(),
        }));

        await tx.insert(stepImages).values(imagesToInsert).onConflictDoNothing();
      }

      const refs = stepIngredientRefsMap.get(stepIdentityKey(stepRow));

      if (refs && refs.length > 0) {
        let lineIdByOrder = lineIdsBySystem.get(stepRow.systemUsed);

        if (!lineIdByOrder) {
          lineIdByOrder = await loadIngredientLineIdsByOrderTx(tx, recipeId, stepRow.systemUsed);
          lineIdsBySystem.set(stepRow.systemUsed, lineIdByOrder);
        }

        await syncStepIngredientsTx(tx, stepRow.id, refs, lineIdByOrder);
      }
    }

    allSteps.push(...parsed.data);
  }

  return allSteps;
}

/**
 * List all step image URLs stored in the database. Used by startup media
 * cleanup to detect orphaned step image files on disk.
 */
export async function listAllStepImageUrls(): Promise<string[]> {
  const rows = await db.select({ image: stepImages.image }).from(stepImages);

  return rows.map((row) => row.image);
}
