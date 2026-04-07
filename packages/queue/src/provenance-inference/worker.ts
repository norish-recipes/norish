import type { Job } from "bullmq";
import type { ProvenanceInferenceJobData } from "@norish/queue/contracts/job-types";

import { eq } from "drizzle-orm";

import { QUEUE_NAMES, baseWorkerOptions, WORKER_CONCURRENCY, STALLED_INTERVAL } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

import { getBullClient } from "../redis/bullmq";
import { createLogger } from "@norish/shared-server/logger";
import { getRecipeFull, db } from "@norish/db";
import { recipes } from "@norish/db/schema";
import { inferProvenanceForRecipe } from "@norish/api/ai/origin-inferrer";
import { isProvenanceEnabled, getRecipePermissionPolicy } from "@norish/config/server-config-loader";
import { recipeEmitter } from "@norish/trpc/routers/recipes/emitter";
import { emitByPolicy } from "@norish/trpc/helpers";

const log = createLogger("worker:provenance-inference");

/**
 * Process a single provenance inference job.
 */
export async function processProvenanceInferenceJob(
  job: Job<ProvenanceInferenceJobData>
): Promise<void> {
  const { recipeId } = job.data;

  log.info({ jobId: job.id, recipeId }, "Processing provenance inference job");

  // Notify user that origin inference is starting
  const policy = await getRecipePermissionPolicy();
  const { userId, householdKey } = job.data;

  emitByPolicy(recipeEmitter, policy.view, { userId, householdKey }, "processingToast", {
    recipeId,
    titleKey: "processingProvenance",
    severity: "default",
  });

  const enabled = await isProvenanceEnabled();

  if (!enabled) {
    log.info({ recipeId }, "Provenance inference is disabled, skipping");

    emitByPolicy(
      recipeEmitter,
      policy.view,
      { userId, householdKey },
      "provenanceInferenceCompleted",
      { recipeId }
    );

    return;
  }

  // Fetch recipe data for analysis
  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    log.error({ recipeId }, "Recipe not found for origin inference");

    return;
  }

  // Prep data for AI
  const result = await inferProvenanceForRecipe({
    title: recipe.name,
    description: recipe.description,
    ingredients: recipe.recipeIngredients.map((ri) =>
      `${ri.amount || ""} ${ri.unit || ""} ${ri.ingredientName}`.trim()
    ),
  });

  // Call AI

  if (!result.success) {
    log.error(
      { recipeId, error: result.error, code: result.code },
      "Failed to infer origin with AI"
    );

    // Distinguish between transient and permanent errors
    // Permanent errors should NOT throw, so the job completes (and doesn't retry)
    const PERMANENT_ERRORS = ["AI_DISABLED", "INVALID_INPUT", "EMPTY_RESPONSE", "MODEL_NOT_FOUND"];

    if (result.code && PERMANENT_ERRORS.includes(result.code)) {
      log.warn(
        { recipeId, code: result.code },
        "Permanent failure in origin inference - not retrying"
      );

      return;
    }

    // For other errors (transient), throw to trigger BullMQ retry
    throw new Error(result.error);
  }

  const { originCountry, originRegion, cuisines, provenanceNote } = result.data;

  // Update recipe in database
  await db
    .update(recipes)
    .set({
      originCountry,
      originRegion,
      cuisines,
      provenanceNote,
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, recipeId));

  // Fetch updated recipe and emit events
  const updatedRecipe = await getRecipeFull(recipeId);

  if (updatedRecipe) {
    emitByPolicy(recipeEmitter, policy.view, { userId, householdKey }, "updated", {
      recipe: updatedRecipe,
    });
  }

  // Notify user

  emitByPolicy(
    recipeEmitter,
    policy.view,
    { userId, householdKey },
    "provenanceInferenceCompleted",
    { recipeId }
  );

  emitByPolicy(recipeEmitter, policy.view, { userId, householdKey }, "processingToast", {
    recipeId,
    titleKey: "provenanceComplete",
    severity: "success",
  });

  log.info({ recipeId, originCountry }, "Provenance inference completed and saved");
}

/**
 * Handle job failure.
 */
async function handleJobFailed(
  job: Job<ProvenanceInferenceJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;
  log.error(
    { jobId: job.id, recipeId: job.data.recipeId, error: error.message },
    "Provenance inference job failed"
  );
}

/**
 * Start the provenance inference worker.
 */
export async function startProvenanceInferenceWorker(): Promise<void> {
  await createLazyWorker<ProvenanceInferenceJobData>(
    QUEUE_NAMES.PROVENANCE_INFERENCE,
    processProvenanceInferenceJob,
    {
      connection: getBullClient() as any,
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.PROVENANCE_INFERENCE],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.PROVENANCE_INFERENCE],
    },
    handleJobFailed
  );
}

export async function stopProvenanceInferenceWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.PROVENANCE_INFERENCE);
}
