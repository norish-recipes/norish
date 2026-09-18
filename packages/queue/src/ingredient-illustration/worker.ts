/**
 * Ingredient Illustration Worker
 *
 * One request, one job (ADR-0037): an ingredient's name is all an image model
 * needs to draw it, so unlike a dish there is no brief in front of the image
 * call. The picture is drawn square from the administrator-editable Ingredient
 * Illustration prompt and stored through the one storage operation, which
 * points the Ingredient Name at it.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";

import type { IngredientIllustrationJobData } from "@norish/queue/contracts/job-types";
import { findIngredientById } from "@norish/db/repositories/ingredients";
import { AIError } from "@norish/shared-server/ai/runtime/errors";
import { generateImage } from "@norish/shared-server/ai/runtime/runtime";
import { createLogger } from "@norish/shared-server/logger";
import { storeIngredientIllustration } from "@norish/shared-server/media/ingredient-illustration";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { reportStep } from "../job-steps";

const log = createLogger("worker:ingredient-illustration");

/** Exported so the job body can be exercised without a Redis-backed worker. */
export async function processIngredientIllustrationJob(
  job: Job<IngredientIllustrationJobData>
): Promise<void> {
  const { ingredientId } = job.data;
  const entry = await findIngredientById(ingredientId);

  if (!entry) {
    // Deleted after it was queued: there is nothing left to draw for.
    log.info({ ingredientId }, "Ingredient Name gone; skipping illustration");

    return;
  }

  await reportStep(job, "ai-request");

  let bytes: Buffer;

  try {
    const image = await generateImage({
      prompt: "ingredient-illustration-style",
      sections: [entry.name],
      shape: "square",
    });

    bytes = image.bytes;
  } catch (error) {
    // AI switched off, no image provider, or a refusal: a retry cannot
    // succeed, so no billed attempts are burned on it.
    if (error instanceof AIError && !error.retryable) {
      throw new UnrecoverableError(error.message);
    }

    throw error;
  }

  await reportStep(job, "saving");

  const imageUrl = await storeIngredientIllustration(ingredientId, bytes);

  log.info({ ingredientId, imageUrl }, "Ingredient Illustration stored");
}

function logFailure(job: Job<IngredientIllustrationJobData> | undefined, error: Error): void {
  log.error(
    {
      jobId: job?.id,
      ingredientId: job?.data.ingredientId,
      attempt: job?.attemptsMade,
      err: error,
    },
    "Ingredient Illustration failed"
  );
}

const ingredientIllustrationWorker = defineLazyWorker<IngredientIllustrationJobData>(
  QUEUE_NAMES.INGREDIENT_ILLUSTRATION,
  processIngredientIllustrationJob,
  logFailure
);

export const startIngredientIllustrationWorker = ingredientIllustrationWorker.start;
export const stopIngredientIllustrationWorker = ingredientIllustrationWorker.stop;
