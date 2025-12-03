import type { StepDto, StepInsertDto } from "@/types/dto/steps";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { steps } from "@/server/db/schema";
import { StepSelectBaseSchema } from "@/server/db/zodSchemas/steps";
import { dbLogger } from "@/server/logger";
import { stripHtmlTags } from "@/lib/helpers";

const StepArraySchema = z.array(StepSelectBaseSchema);

export async function createManyRecipeStepsTx(
  tx: any,
  rawSteps: StepInsertDto[]
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

  await tx.insert(steps).values(unique).onConflictDoNothing();

  const recipeIds = Array.from(new Set(unique.map((s) => s.recipeId)));
  const allSteps: StepDto[] = [];

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

    allSteps.push(...parsed.data);
  }

  return allSteps;
}
