import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { StepDto, StepInsertDto } from "@norish/shared/contracts/dto/steps";
import { db } from "@norish/db/drizzle";
import { dbLogger } from "@norish/db/logger";
import { stepImages, steps } from "@norish/db/schema";
import { StepSelectBaseSchema } from "@norish/shared/contracts/zod/steps";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

const StepArraySchema = z.array(StepSelectBaseSchema);

export type StepInsertWithImages = StepInsertDto & {
  images?: { image: string; order: number }[];
};

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
    .map((s, index) => ({ ...s, order: s.order ?? index, step: stripHtmlTags(s.step) }))
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

  for (const s of unique) {
    if (s.images && s.images.length > 0) {
      stepImagesMap.set(stepIdentityKey(s), s.images);
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

    // Insert step images
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
