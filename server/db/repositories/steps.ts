import type { StepDto, StepInsertDto } from "@/types/dto/steps";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { steps, stepImages } from "@/server/db/schema";
import { StepSelectBaseSchema } from "@/server/db/zodSchemas/steps";
import { dbLogger } from "@/server/logger";
import { stripHtmlTags } from "@/lib/helpers";

const StepArraySchema = z.array(StepSelectBaseSchema);

export type StepInsertWithImages = StepInsertDto & {
  images?: { image: string; order: number }[];
};

export async function createManyRecipeStepsTx(
  tx: any,
  rawSteps: StepInsertWithImages[]
): Promise<StepDto[]> {
  if (!rawSteps.length) return [];

  const cleaned = rawSteps
    .map((s) => ({ ...s, step: stripHtmlTags(s.step) }))
    .filter((s) => s.step.length > 0 && s.recipeId);

  if (cleaned.length === 0) return [];

  const seen = new Set<string>();
  const unique = cleaned.filter((s) => {
    const key = `${s.recipeId}-${s.systemUsed}-${s.step.toLowerCase().trim()}`;

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });

  // Insert steps (without images)
  const stepsToInsert = unique.map(({ images: _images, ...step }) => step);

  await tx.insert(steps).values(stepsToInsert).onConflictDoNothing();

  const recipeIds = Array.from(new Set(unique.map((s) => s.recipeId)));
  const allSteps: StepDto[] = [];

  // Map to track step text and images for insertion
  const stepImagesMap = new Map<string, { image: string; order: number }[]>();

  for (const s of unique) {
    if (s.images && s.images.length > 0) {
      const key = `${s.recipeId}-${s.systemUsed}-${s.step}`;

      stepImagesMap.set(key, s.images);
    }
  }

  for (const recipeId of recipeIds) {
    const subset = unique.filter((s) => s.recipeId === recipeId);
    const rows = await tx
      .select()
      .from(steps)
      .where(
        and(
          eq(steps.recipeId, recipeId),
          inArray(
            steps.step,
            subset.map((s) => s.step)
          )
        )
      );

    const parsed = StepArraySchema.safeParse(rows);

    if (!parsed.success) {
      dbLogger.error({ err: parsed.error }, "Failed to parse steps");
      throw new Error(`Failed to parse steps after insert for recipe ${recipeId}`);
    }

    // Insert step images
    for (const stepRow of rows) {
      const key = `${stepRow.recipeId}-${stepRow.systemUsed}-${stepRow.step}`;
      const images = stepImagesMap.get(key);

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
