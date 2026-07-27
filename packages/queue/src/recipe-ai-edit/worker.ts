/**
 * Recipe AI Edit Worker
 *
 * Processes recipe AI edit jobs from the queue.
 * Applies a natural-language edit instruction to an existing recipe using AI,
 * then persists the result and emits realtime updates.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { RecipeAiEditJobData } from "@norish/queue/contracts/job-types";
import type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
import type { FullRecipeUpdateDTO } from "@norish/shared/contracts/dto/recipe";
import { applyRecipeAiEdit, getRecipeFull } from "@norish/db";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { emitByPolicy } from "@norish/shared-server/realtime/policy";
import { recipeEmitter } from "@norish/shared-server/realtime/recipes";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { reportStep } from "../job-steps";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:recipe-ai-edit");

export async function processRecipeAiEditJob(job: Job<RecipeAiEditJobData>): Promise<void> {
  const editRecipeWithAI = requireQueueApiHandler("editRecipeWithAI");
  const { recipeId, userId, householdKey, instruction, version } = job.data;

  log.info(
    { jobId: job.id, recipeId, attempt: job.attemptsMade + 1 },
    "Processing recipe AI edit job"
  );

  const policy = await getRecipePermissionPolicy();
  const ctx: PolicyEmitContext = { userId, householdKey };

  // Emit started + toast so clients can show a loading state. Only on the first
  // attempt so retries don't spam a second toast (the spinner is already on).
  if (job.attemptsMade === 0) {
    emitByPolicy(recipeEmitter, policy.view, ctx, "aiEditStarted", { recipeId });
    emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
      recipeId,
      titleKey: "processingAiEdit",
      severity: "default",
    });
  }

  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  await reportStep(job, "ai-request");
  const result = await editRecipeWithAI(recipe, instruction, recipeId);

  if (!result.success) {
    throw new Error(result.error);
  }

  const edited = result.data;

  // Build an update payload from the AI result. Media (images/videos) and the
  // source URL are omitted so they are preserved. The active measurement system
  // is kept as-is; ingredients/steps carry their own systemUsed and are replaced
  // per-system by applyRecipeAiEdit, and tags are merged (not overwritten).
  const updatePayload: FullRecipeUpdateDTO = {
    name: edited.name,
    description: edited.description ?? null,
    notes: edited.notes ?? null,
    servings: edited.servings,
    prepMinutes: edited.prepMinutes,
    cookMinutes: edited.cookMinutes,
    totalMinutes: edited.totalMinutes,
    calories: edited.calories,
    fat: edited.fat,
    carbs: edited.carbs,
    protein: edited.protein,
    systemUsed: recipe.systemUsed,
    categories: edited.categories,
    tags: edited.tags,
    recipeIngredients: edited.recipeIngredients,
    steps: edited.steps,
  };

  await reportStep(job, "saving");
  const outcome = await applyRecipeAiEdit(recipeId, userId, updatePayload, version);

  if (outcome.stale) {
    log.info(
      { jobId: job.id, recipeId, version },
      "Recipe changed during AI edit, ignoring stale result"
    );
    emitByPolicy(recipeEmitter, policy.view, ctx, "aiEditCompleted", { recipeId });
    emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
      recipeId,
      titleKey: "aiEditStale",
      severity: "default",
    });

    return;
  }

  log.info({ jobId: job.id, recipeId }, "Recipe AI edit completed and saved");

  const updatedRecipe = await getRecipeFull(recipeId);

  if (updatedRecipe) {
    emitByPolicy(recipeEmitter, policy.view, ctx, "updated", { recipe: updatedRecipe });
  }

  emitByPolicy(recipeEmitter, policy.view, ctx, "aiEditCompleted", { recipeId });
  emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
    recipeId,
    titleKey: "aiEditComplete",
    severity: "success",
  });
}

async function handleJobFailed(
  job: Job<RecipeAiEditJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId, userId, householdKey } = job.data;
  const maxAttempts = job.opts.attempts ?? 2;
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
    "Recipe AI edit job failed"
  );

  if (!isFinalFailure) return;

  // Notify the client once retries are exhausted so the loading state clears.
  const policy = await getRecipePermissionPolicy();
  const ctx: PolicyEmitContext = { userId, householdKey };

  emitByPolicy(recipeEmitter, policy.view, ctx, "aiEditCompleted", { recipeId });
  emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
    recipeId,
    titleKey: "aiEditFailed",
    severity: "default",
  });
}

export async function startRecipeAiEditWorker(): Promise<void> {
  await createLazyWorker<RecipeAiEditJobData>(
    QUEUE_NAMES.RECIPE_AI_EDIT,
    processRecipeAiEditJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.RECIPE_AI_EDIT],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.RECIPE_AI_EDIT],
    },
    handleJobFailed
  );
}

export async function stopRecipeAiEditWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.RECIPE_AI_EDIT);
}
