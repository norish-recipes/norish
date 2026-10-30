/**
 * Image Generation Worker
 *
 * Two AI requests, one job (ADR-0024): a structured call turns the stored
 * recipe into a short visual brief, and the image model draws from the brief.
 * The result is stored through the one replacement operation (ADR-0025) and
 * the Dish Colour is recomputed from the image just written, so the canonical
 * recipe update carries the new tint.
 *
 * The worker holds no database handle and composes no queries: eligibility
 * was the coordinator's decision, and the storage operation is the only
 * write. The brief is never stored and never shown.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { writeVisualBrief } from "@norish/shared-server/ai/enrichment/image-briefer";
import { generateImage } from "@norish/shared-server/ai/runtime/runtime";
import { createLogger } from "@norish/shared-server/logger";
import { refreshDishColorForRecipe } from "@norish/shared-server/media/dish-color";
import { storeGeneratedRecipeImage } from "@norish/shared-server/media/generated-image";

import { createWorker } from "../create-worker";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:image-generation");

/** Exported so the job body can be exercised without a Valkey-backed worker. */
export async function processImageGenerationJob(job: Job<RecipeEnrichmentJobData>): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    // Brief first: an image model is prompted rather than reasoned with, so
    // the cheap text call decides what the expensive one draws.
    const brief = await writeVisualBrief(toRecipeSummary(recipe));

    const image = await generateImage({
      prompt: "image-generation-style",
      sections: [brief],
    });

    await reportStep(job, "saving");

    const imageUrl = await storeGeneratedRecipeImage(recipe.id, image.bytes);

    // Replacing the primary changes the Dish Colour (ADR-0023); recompute it
    // here so the canonical update the runner publishes carries the new tint.
    await refreshDishColorForRecipe(recipe.id);

    log.info(
      { recipeId: recipe.id, imageUrl, origin: job.data.origin },
      "Generated Image stored as primary"
    );

    return true;
  });
}

export function startImageGenerationWorker(): void {
  createWorker<RecipeEnrichmentJobData>(QUEUE_NAMES.IMAGE_GENERATION, processImageGenerationJob, {
    onFailed: handleEnrichmentJobFailure,
  });
}
