import type { Job } from "bullmq";

import type { AutoCategorizationJobData } from "@norish/queue/contracts/job-types";
import type { PolicyEmitContext } from "@norish/trpc/helpers";
import { getRecipePermissionPolicy } from "@norish/config/server-config-loader";
import { getRecipeFull, updateRecipeCategories } from "@norish/db";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { createLogger } from "@norish/shared-server/logger";
import { emitByPolicy } from "@norish/trpc/helpers";
import { recipeEmitter } from "@norish/trpc/routers/recipes/emitter";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:auto-categorization");

async function processAutoCategorizationJob(job: Job<AutoCategorizationJobData>): Promise<void> {
  const categorizeRecipe = requireQueueApiHandler("categorizeRecipe");
  const { recipeId, userId, householdKey } = job.data;

  log.info(
    { jobId: job.id, recipeId, attempt: job.attemptsMade + 1 },
    "Processing auto-categorization job"
  );

  const policy = await getRecipePermissionPolicy();
  const ctx: PolicyEmitContext = { userId, householdKey };

  emitByPolicy(recipeEmitter, policy.view, ctx, "autoCategorizationStarted", { recipeId });

  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  if (recipe.categories.length > 0) {
    log.info({ recipeId }, "Recipe already has categories, skipping auto-categorization");
    emitByPolicy(recipeEmitter, policy.view, ctx, "autoCategorizationCompleted", { recipeId });

    return;
  }

  if (recipe.recipeIngredients.length === 0) {
    log.warn({ recipeId }, "Recipe has no ingredients, skipping auto-categorization");
    emitByPolicy(recipeEmitter, policy.view, ctx, "autoCategorizationCompleted", { recipeId });

    return;
  }

  const recipeForCategorization = {
    title: recipe.name,
    description: recipe.description,
    ingredients: recipe.recipeIngredients.map((ri) => ri.ingredientName),
  };

  const result = await categorizeRecipe(recipeForCategorization);

  if (!result.success) {
    throw new Error(result.error);
  }

  const categories = result.data;

  if (categories.length === 0) {
    log.info({ recipeId }, "AI returned no categories");
    emitByPolicy(recipeEmitter, policy.view, ctx, "autoCategorizationCompleted", { recipeId });

    return;
  }

  await updateRecipeCategories(recipeId, categories);

  log.info(
    { jobId: job.id, recipeId, categories, totalCategories: categories.length },
    "Auto-categorization completed and saved"
  );

  const updatedRecipe = await getRecipeFull(recipeId);

  if (updatedRecipe) {
    emitByPolicy(recipeEmitter, policy.view, ctx, "updated", { recipe: updatedRecipe });
  }

  emitByPolicy(recipeEmitter, policy.view, ctx, "autoCategorizationCompleted", { recipeId });
}

async function handleJobFailed(
  job: Job<AutoCategorizationJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;
  const isFinalFailure = job.attemptsMade >= maxAttempts;

  log.error(
    {
      jobId: job.id,
      recipeId,
      attempt: job.attemptsMade,
      maxAttempts,
      isFinalFailure,
      error: error.message,
    },
    "Auto-categorization job failed"
  );
}

export async function startAutoCategorizationWorker(): Promise<void> {
  await createLazyWorker<AutoCategorizationJobData>(
    QUEUE_NAMES.AUTO_CATEGORIZATION,
    processAutoCategorizationJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.AUTO_CATEGORIZATION],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.AUTO_CATEGORIZATION],
    },
    handleJobFailed
  );
}

export async function stopAutoCategorizationWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.AUTO_CATEGORIZATION);
}
