/**
 * Nutrition Estimation Worker
 *
 * Processes nutrition estimation jobs from the queue.
 * Runs in-process with the main server.
 */

import type { NutritionEstimationJobData } from "@/types";

import { Worker, Job } from "bullmq";

import { redisConnection, QUEUE_NAMES } from "../config";

import { createLogger } from "@/server/logger";
import { emitByPolicy, type PolicyEmitContext } from "@/server/trpc/helpers";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import { getRecipeFull, updateRecipeWithRefs } from "@/server/db";
import { estimateNutritionFromIngredients } from "@/server/ai/nutrition-estimator";

const log = createLogger("worker:nutrition-estimation");

let worker: Worker<NutritionEstimationJobData> | null = null;

async function processNutritionJob(job: Job<NutritionEstimationJobData>): Promise<void> {
  const { recipeId, userId, householdKey } = job.data;

  log.info(
    { jobId: job.id, recipeId, attempt: job.attemptsMade + 1 },
    "Processing nutrition estimation job"
  );

  const policy = await getRecipePermissionPolicy();
  const ctx: PolicyEmitContext = { userId, householdKey };

  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  if (recipe.recipeIngredients.length === 0) {
    throw new Error("Recipe has no ingredients to estimate from");
  }

  const ingredients = recipe.recipeIngredients.map((ri) => ({
    ingredientName: ri.ingredientName,
    amount: ri.amount,
    unit: ri.unit,
  }));

  const estimate = await estimateNutritionFromIngredients(
    recipe.name,
    recipe.servings ?? 1,
    ingredients
  );

  if (!estimate) {
    throw new Error("Failed to estimate nutrition from AI");
  }

  // Update recipe with estimated nutrition
  await updateRecipeWithRefs(recipe.id, userId, {
    calories: estimate.calories,
    fat: estimate.fat.toString(),
    carbs: estimate.carbs.toString(),
    protein: estimate.protein.toString(),
  });

  // Fetch updated recipe and emit event
  const updatedRecipe = await getRecipeFull(recipe.id);

  if (updatedRecipe) {
    log.info({ jobId: job.id, recipeId }, "Nutrition estimated and saved");

    emitByPolicy(recipeEmitter, policy.view, ctx, "updated", { recipe: updatedRecipe });
  }
}

async function handleJobFailed(
  job: Job<NutritionEstimationJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId, userId, householdKey } = job.data;
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
    "Nutrition estimation job failed"
  );

  if (isFinalFailure) {
    // Emit failed event with recipeId to clear loading state
    const policy = await getRecipePermissionPolicy();
    const ctx: PolicyEmitContext = { userId, householdKey };

    emitByPolicy(recipeEmitter, policy.view, ctx, "failed", {
      reason: error.message || "Failed to estimate nutrition after multiple attempts",
      recipeId,
    });
  }
}

export function startNutritionEstimationWorker(): void {
  if (worker) {
    log.warn("Nutrition estimation worker already running");

    return;
  }

  worker = new Worker<NutritionEstimationJobData>(
    QUEUE_NAMES.NUTRITION_ESTIMATION,
    processNutritionJob,
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Nutrition estimation job completed");
  });

  worker.on("failed", (job, error) => {
    handleJobFailed(job, error);
  });

  worker.on("error", (error) => {
    log.error({ error }, "Nutrition estimation worker error");
  });

  log.info("Nutrition estimation worker started");
}

export async function stopNutritionEstimationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("Nutrition estimation worker stopped");
  }
}
