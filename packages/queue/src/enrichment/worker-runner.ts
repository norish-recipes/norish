/**
 * Recipe Enrichment worker runner.
 *
 * A worker owns exactly one AI request, its output validation, the repository
 * write, and the lifecycle it publishes. It owns no import-path policy and no
 * enrollment policy — by the time a job exists, the coordinator has decided the
 * kind should run.
 *
 * The lifecycle publication is shared here so every kind reports the same
 * five states through the same event, and so origin decides who hears about a
 * failure: automatic work stays quiet, a manual request tells its requester.
 */

import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { getRecipeFull } from "@norish/db";
import { AIError } from "@norish/shared-server/ai/runtime/errors";
import { createLogger } from "@norish/shared-server/logger";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";
import { reportStep } from "../job-steps";
import { publishEnrichmentLifecycle, publishEnrichmentRecipeUpdated } from "./announce";

const log = createLogger("worker:enrichment");

/**
 * What one kind does once its job runs.
 *
 * @returns whether the recipe changed. `false` means the AI produced nothing to
 *   apply or a conditional write found newer supplied data — both are successes.
 */
export type EnrichmentExecutor = (
  recipe: FullRecipeDTO,
  job: Job<RecipeEnrichmentJobData>
) => Promise<boolean>;

/**
 * Run one enrichment job: publish `processing`, execute, then publish
 * `succeeded` alongside the canonical updated recipe. The producer publishes
 * `queued` when BullMQ accepts the job; clients ignore that event if it arrives
 * after this later worker state.
 *
 * A thrown error is how a worker signals a retryable failure, and BullMQ's
 * existing attempts and backoff decide when it becomes terminal — except for
 * an AI failure that says a retry cannot succeed (AI having been switched
 * off being the motivating case), which is rethrown as unrecoverable so no
 * attempts are burned on a state that will not change.
 */
export async function runEnrichmentJob(
  job: Job<RecipeEnrichmentJobData>,
  execute: EnrichmentExecutor
): Promise<void> {
  const { recipeId, kind, origin } = job.data;

  log.info({ jobId: job.id, recipeId, kind, origin, attempt: job.attemptsMade + 1 }, "Processing");

  await publishEnrichmentLifecycle(job.data, "processing");

  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  await reportStep(job, "ai-request");

  let changed: boolean;

  try {
    changed = await execute(recipe, job);
  } catch (error) {
    if (error instanceof AIError && !error.retryable) {
      throw new UnrecoverableError(error.message);
    }

    throw error;
  }

  if (changed) {
    // Canonical recipe update, so clients refresh caches directly instead of
    // refetching after a success they were already told about.
    const updated = await getRecipeFull(recipeId);

    if (updated) {
      await publishEnrichmentRecipeUpdated(job.data, updated);
    }
  }

  log.info({ jobId: job.id, recipeId, kind, origin, changed }, "Enrichment succeeded");

  await publishEnrichmentLifecycle(job.data, "succeeded");
}

/**
 * Report a failed attempt. Only the final attempt is terminal, and only a
 * terminal failure publishes `failed`, because intermediate attempts are still
 * `processing` from a reader's point of view. An unrecoverable failure is
 * terminal on whatever attempt it happens: BullMQ stops retrying it.
 */
export async function handleEnrichmentJobFailure(
  job: Job<RecipeEnrichmentJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId, kind, origin } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;
  const isFinalFailure = job.attemptsMade >= maxAttempts || error instanceof UnrecoverableError;

  log.error(
    {
      jobId: job.id,
      recipeId,
      kind,
      origin,
      attempt: job.attemptsMade,
      maxAttempts,
      isFinalFailure,
      err: error,
    },
    "Recipe Enrichment job failed"
  );

  if (isFinalFailure) {
    await publishEnrichmentLifecycle(job.data, "failed");
  }
}

/** Kinds whose AI handler needs a plain recipe summary. */
export function toRecipeSummary(recipe: FullRecipeDTO) {
  return {
    title: recipe.name,
    description: recipe.description,
    ingredients: recipe.recipeIngredients.map((ingredient) => ingredient.ingredientName),
  };
}
