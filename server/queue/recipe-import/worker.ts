/**
 * Recipe Import Worker
 *
 * Processes recipe import jobs from the queue.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeImportJobData } from "@/types";
import type { Job } from "bullmq";

import {
  QUEUE_NAMES,
  RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
  baseWorkerOptions,
  WORKER_CONCURRENCY,
  STALLED_INTERVAL,
} from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";
import { withTimeout } from "../helpers";

import { getBullClient } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";
import { emitByPolicy, type PolicyEmitContext } from "@/server/trpc/helpers";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getRecipePermissionPolicy, getAIConfig } from "@/config/server-config-loader";
import { getQueues } from "@/server/queue/registry";
import { addAutoTaggingJob } from "@/server/queue/auto-tagging/producer";
import { addAllergyDetectionJob } from "@/server/queue/allergy-detection/producer";
import { addAutoCategorizationJob } from "@/server/queue/auto-categorization/producer";
import {
  createRecipeWithRefs,
  recipeExistsByUrlForPolicy,
  dashboardRecipe,
  getAllergiesForUsers,
} from "@/server/db";
import { getDecryptedTokensByUserId } from "@/server/db/repositories/site-auth-tokens";
import { parseRecipeFromUrl } from "@/server/parser";
import { deleteRecipeImagesDir } from "@/server/downloader";

const log = createLogger("worker:recipe-import");

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
      // Show imported toast since no processing will follow for existing recipes
      emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
        recipe: dashboardDto,
        pendingRecipeId: recipeId,
        toast: "imported",
      });
    }

    return;
  }

  // Fetch household allergies for targeted allergy detection (only if autoTagAllergies is enabled)
  const aiConfig = await getAIConfig();
  let allergyNames: string[] | undefined;

  if (aiConfig?.autoTagAllergies) {
    const householdAllergies = await getAllergiesForUsers(householdUserIds ?? [userId]);

    allergyNames = [...new Set(householdAllergies.map((a) => a.tagName))];
    log.debug(
      { allergyCount: allergyNames.length, allergies: allergyNames },
      "Fetched household allergies"
    );
  } else {
    log.debug("Auto-tag allergies disabled, skipping allergy detection");
  }

  // Parse and create recipe
  const userTokens = await getDecryptedTokensByUserId(userId);
  const parseResult = await withTimeout(
    () =>
      parseRecipeFromUrl(
        url,
        recipeId,
        allergyNames,
        job.data.forceAI,
        userTokens.length > 0 ? userTokens : undefined
      ),
    RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
    "Recipe import parsing"
  );

  log.debug({ parseResult }, "Recipe parse result");
  if (!parseResult.recipe) {
    throw new Error("Failed to parse recipe from URL");
  }

  const createdId = await createRecipeWithRefs(recipeId, userId, parseResult.recipe);

  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info(
      { jobId: job.id, recipeId: createdId, url, usedAI: parseResult.usedAI },
      "Recipe imported successfully"
    );

    // If AI was used, no processing will follow - show imported toast
    // If AI was NOT used, auto-tagging/allergy detection will follow - no toast needed
    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
      toast: parseResult.usedAI ? "imported" : undefined,
    });

    // Trigger auto-tagging only if AI was NOT used for extraction
    // (AI extraction already includes auto-tagging instructions in the prompt)
    if (!parseResult.usedAI) {
      const queues = getQueues();

      await addAutoTaggingJob(queues.autoTagging, {
        recipeId: createdId,
        userId,
        householdKey,
      });

      // Trigger allergy detection for structured imports
      // (AI extraction already handles allergy detection inline)
      await addAllergyDetectionJob(queues.allergyDetection, {
        recipeId: createdId,
        userId,
        householdKey,
      });

      // Trigger auto-categorization for structured imports without categories
      // (AI extraction already includes categorization in the prompt)
      if (!parseResult.recipe.categories?.length) {
        await addAutoCategorizationJob(queues.autoCategorization, {
          recipeId: createdId,
          userId,
          householdKey,
        });
      }
    }
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

  await deleteRecipeImagesDir(recipeId);

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
 * Start the recipe import worker (lazy - starts on demand).
 * Call during server startup.
 */
export async function startRecipeImportWorker(): Promise<void> {
  await createLazyWorker<RecipeImportJobData>(
    QUEUE_NAMES.RECIPE_IMPORT,
    (job) =>
      withTimeout(
        () => processImportJob(job),
        RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
        "Recipe import job"
      ),
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.RECIPE_IMPORT],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.RECIPE_IMPORT],
    },
    handleJobFailed
  );
}

export async function stopRecipeImportWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.RECIPE_IMPORT);
}
