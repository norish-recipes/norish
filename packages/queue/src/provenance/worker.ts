/**
 * Recipe Provenance Worker
 *
 * Infers a recipe's origin/cuisine provenance through the registered AI-handler
 * boundary, then persists it atomically via the repository. Reports AI-request
 * and saving steps, emits the provenance lifecycle over the recipe realtime
 * channel by view policy, and emits `updated` on success so open recipe views
 * refresh seamlessly. Permanent AI failures stop retrying; transient failures
 * use bounded queue retries and emit a terminal failure on exhaustion.
 */
import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";

import type { ProvenanceJobData } from "@norish/queue/contracts/job-types";
import type { AIErrorCode } from "@norish/shared-server/ai/types/result";
import type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
import { getRecipeFull, updateRecipeProvenance } from "@norish/db";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { emitByPolicy } from "@norish/shared-server/realtime/policy";
import { recipeEmitter } from "@norish/shared-server/realtime/recipes";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { reportStep } from "../job-steps";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:provenance");

/** AI failures that are permanent — retrying them cannot succeed. */
const PERMANENT_AI_CODES: ReadonlySet<AIErrorCode> = new Set<AIErrorCode>([
  "AI_DISABLED",
  "INVALID_INPUT",
  "VALIDATION_ERROR",
  "EMPTY_RESPONSE",
  "AUTH_ERROR",
]);

async function processProvenanceJob(job: Job<ProvenanceJobData>): Promise<void> {
  const inferRecipeProvenance = requireQueueApiHandler("inferRecipeProvenance");
  const { recipeId, userId, householdKey } = job.data;

  log.info(
    { jobId: job.id, recipeId, attempt: job.attemptsMade + 1 },
    "Processing provenance inference job"
  );

  const policy = await getRecipePermissionPolicy();
  const ctx: PolicyEmitContext = { userId, householdKey };

  emitByPolicy(recipeEmitter, policy.view, ctx, "provenance", { recipeId, status: "processing" });

  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    // A missing recipe can never be enriched — do not retry.
    throw new UnrecoverableError(`Recipe not found: ${recipeId}`);
  }

  await reportStep(job, "ai-request");
  // Only recipe content needed for attribution is sent to the provider.
  const result = await inferRecipeProvenance({
    title: recipe.name,
    description: recipe.description,
    ingredients: recipe.recipeIngredients.map((ri) => ri.ingredientName),
  });

  if (!result.success) {
    if (PERMANENT_AI_CODES.has(result.code)) {
      throw new UnrecoverableError(result.error);
    }

    throw new Error(result.error);
  }

  await reportStep(job, "saving");
  // A single atomic write updates every provenance value together.
  await updateRecipeProvenance(recipeId, result.data);

  log.info(
    { jobId: job.id, recipeId, originCountryCode: result.data.originCountryCode },
    "Provenance inference completed and saved"
  );

  const updatedRecipe = await getRecipeFull(recipeId);

  if (updatedRecipe) {
    emitByPolicy(recipeEmitter, policy.view, ctx, "updated", { recipe: updatedRecipe });
  }

  emitByPolicy(recipeEmitter, policy.view, ctx, "provenance", { recipeId, status: "succeeded" });
}

async function handleJobFailed(
  job: Job<ProvenanceJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId, userId, householdKey } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;
  // UnrecoverableError halts retries immediately, so it is always terminal.
  const isFinalFailure =
    error.name === "UnrecoverableError" || job.attemptsMade >= maxAttempts;

  log.error(
    { jobId: job.id, recipeId, attempt: job.attemptsMade, maxAttempts, isFinalFailure, error: error.message },
    "Provenance inference job failed"
  );

  if (isFinalFailure) {
    const policy = await getRecipePermissionPolicy();
    const ctx: PolicyEmitContext = { userId, householdKey };

    emitByPolicy(recipeEmitter, policy.view, ctx, "provenance", { recipeId, status: "failed" });
  }
}

export async function startProvenanceWorker(): Promise<void> {
  await createLazyWorker<ProvenanceJobData>(
    QUEUE_NAMES.PROVENANCE,
    processProvenanceJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.PROVENANCE],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.PROVENANCE],
    },
    handleJobFailed
  );
}

export async function stopProvenanceWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.PROVENANCE);
}
