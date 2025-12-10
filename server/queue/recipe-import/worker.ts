/**
 * Recipe Import Worker
 *
 * Processes recipe import jobs from the queue.
 * Runs in-process with the main server.
 */

import type { RecipeImportJobData } from "@/types";

import { Worker, Job } from "bullmq";

import { redisConnection, QUEUE_NAMES } from "../config";

import { createLogger } from "@/server/logger";
import { emitByPolicy, type PolicyEmitContext } from "@/server/trpc/helpers";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import { createRecipeWithRefs, recipeExistsByUrlForPolicy, dashboardRecipe } from "@/server/db";
import { parseRecipeFromUrl } from "@/lib/parser";

const log = createLogger("worker:recipe-import");

let worker: Worker<RecipeImportJobData> | null = null;

/**
 * Process a single recipe import job.
 * Called by the worker for each job.
 */
async function processImportJob(job: Job<RecipeImportJobData>): Promise<void> {
  const { url, recipeId, userId, householdKey, householdUserIds } = job.data;

  log.info(
    { jobId: job.id, url, recipeId, attempt: job.attemptsMade + 1 },
    "Processing recipe import job"
  );

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  // Emit import started event
  emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", { recipeId, url });

  // Check if recipe already exists (policy-aware)
  const existingCheck = await recipeExistsByUrlForPolicy(url, userId, householdUserIds, viewPolicy);

  if (existingCheck.exists && existingCheck.existingRecipeId) {
    const dashboardDto = await dashboardRecipe(existingCheck.existingRecipeId);

    if (dashboardDto) {
      log.info(
        { jobId: job.id, existingRecipeId: existingCheck.existingRecipeId },
        "Recipe already exists, returning existing"
      );

      // Include pendingRecipeId so client can remove the skeleton
      emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
        recipe: dashboardDto,
        pendingRecipeId: recipeId,
      });
    }

    return;
  }

  // Parse and create recipe
  const parsedRecipe = await parseRecipeFromUrl(url);
  if (!parsedRecipe) {
    throw new Error("Failed to parse recipe from URL");
  }

  const createdId = await createRecipeWithRefs(recipeId, userId, parsedRecipe);
  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  const dashboardDto = await dashboardRecipe(createdId);
  if (dashboardDto) {
    log.info({ jobId: job.id, recipeId: createdId, url }, "Recipe imported successfully");

    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
    });
  }
}

/**
 * Handle job failure.
 * Emits failed event if this was the final attempt.
 */
async function handleJobFailed(
  job: Job<RecipeImportJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { url, recipeId, userId, householdKey } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;
  const isFinalFailure = job.attemptsMade >= maxAttempts;

  log.error(
    {
      jobId: job.id,
      url,
      recipeId,
      attempt: job.attemptsMade,
      maxAttempts,
      isFinalFailure,
      error: error.message,
    },
    "Recipe import job failed"
  );

  if (isFinalFailure) {
    // Emit failed event to remove skeleton
    const policy = await getRecipePermissionPolicy();
    const ctx: PolicyEmitContext = { userId, householdKey };

    emitByPolicy(recipeEmitter, policy.view, ctx, "failed", {
      reason: error.message || "Failed to import recipe after multiple attempts",
      recipeId,
      url,
    });
  }
}

/**
 * Start the recipe import worker.
 * Call during server startup.
 */
export function startRecipeImportWorker(): void {
  if (worker) {
    log.warn("Recipe import worker already running");
    return;
  }

  worker = new Worker<RecipeImportJobData>(
    QUEUE_NAMES.RECIPE_IMPORT,
    processImportJob,
    {
      connection: redisConnection,
      concurrency: 5, // I am not sure if this is a good value
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Recipe import job completed");
  });

  worker.on("failed", (job, error) => {
    handleJobFailed(job, error);
  });

  worker.on("error", (error) => {
    log.error({ error }, "Recipe import worker error");
  });

  log.info("Recipe import worker started");
}

export async function stopRecipeImportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("Recipe import worker stopped");
  }
}
