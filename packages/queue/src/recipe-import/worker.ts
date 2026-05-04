/**
 * Recipe Import Worker
 *
 * Processes recipe import jobs from the queue.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";
import type { PolicyEmitContext } from "@norish/trpc/helpers";
import { getAIConfig, getRecipePermissionPolicy } from "@norish/config/server-config-loader";
import {
  createRecipeWithRefs,
  dashboardRecipe,
  getAllergiesForUsers,
  recipeExistsByUrlForPolicy,
} from "@norish/db";
import { getDecryptedTokensByUserId } from "@norish/db/repositories/site-auth-tokens";
import { addAllergyDetectionJob } from "@norish/queue/allergy-detection/producer";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { addAutoCategorizationJob } from "@norish/queue/auto-categorization/producer";
import { addAutoTaggingJob } from "@norish/queue/auto-tagging/producer";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { getQueues } from "@norish/queue/registry";
import { createLogger } from "@norish/shared-server/logger";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { emitByPolicy } from "@norish/trpc/helpers";
import { recipeEmitter } from "@norish/trpc/routers/recipes/emitter";

import {
  baseWorkerOptions,
  QUEUE_NAMES,
  RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
  STALLED_INTERVAL,
  WORKER_CONCURRENCY,
} from "../config";
import { withTimeout } from "../helpers";
import { JobLogger } from "../job-logger";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:recipe-import");

/**
 * Process a single recipe import job.
 * Called by the worker for each job.
 */
async function processImportJob(job: Job<RecipeImportJobData>): Promise<void> {
  const parseRecipeFromUrl = requireQueueApiHandler("parseRecipeFromUrl");
  const { url, recipeId, userId, householdKey, householdUserIds } = job.data;

  log.info(
    { jobId: job.id, url, recipeId, attempt: job.attemptsMade + 1 },
    "Processing recipe import job"
  );

  // Create job logger for step tracking
  const jobLogger = await JobLogger.create({
    jobId: job.id!,
    queueName: QUEUE_NAMES.RECIPE_IMPORT,
    userId,
    recipeId,
    description: url,
    input: { url, forceAI: job.data.forceAI ?? false },
    steps: ["check_existing", "fetch_allergies", "parse_recipe", "save_recipe", "post_processing"],
  });

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  // Emit import started event
  emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", { recipeId, url });

  // Step 1: Check if recipe already exists (policy-aware)
  await jobLogger.startStep("check_existing");
  const existingCheck = await recipeExistsByUrlForPolicy(url, userId, householdUserIds, viewPolicy);

  if (existingCheck.exists && existingCheck.existingRecipeId) {
    const dashboardDto = await dashboardRecipe(existingCheck.existingRecipeId);

    if (dashboardDto) {
      log.info(
        { jobId: job.id, existingRecipeId: existingCheck.existingRecipeId },
        "Recipe already exists, returning existing"
      );

      emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
        recipe: dashboardDto,
        pendingRecipeId: recipeId,
        toast: "imported",
      });
    }

    await jobLogger.completeStep("check_existing", {
      alreadyExists: true,
      existingRecipeId: existingCheck.existingRecipeId,
    });
    await jobLogger.complete({ result: "already_exists", existingRecipeId: existingCheck.existingRecipeId });

    return;
  }

  await jobLogger.completeStep("check_existing", { alreadyExists: false });

  // Step 2: Fetch household allergies
  await jobLogger.startStep("fetch_allergies");
  const aiConfig = await getAIConfig();
  let allergyNames: string[] | undefined;

  if (aiConfig?.autoTagAllergies) {
    const householdAllergies = await getAllergiesForUsers(householdUserIds ?? [userId]);

    allergyNames = [...new Set(householdAllergies.map((a) => a.tagName))];
    log.debug(
      { allergyCount: allergyNames.length, allergies: allergyNames },
      "Fetched household allergies"
    );
    await jobLogger.completeStep("fetch_allergies", { allergyCount: allergyNames.length, allergies: allergyNames });
  } else {
    log.debug("Auto-tag allergies disabled, skipping allergy detection");
    await jobLogger.skipStep("fetch_allergies", "autoTagAllergies disabled");
  }

  // Step 3: Parse recipe from URL
  await jobLogger.startStep("parse_recipe");
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
    await jobLogger.failStep("parse_recipe", "Failed to parse recipe from URL");
    await jobLogger.fail("Failed to parse recipe from URL");
    throw new Error("Failed to parse recipe from URL");
  }

  if (parseResult.usedAI && aiConfig?.model) {
    await jobLogger.setAiModel(aiConfig.model);
  }

  await jobLogger.completeStep("parse_recipe", {
    usedAI: parseResult.usedAI,
    title: parseResult.recipe.title,
  });

  // Step 4: Save recipe to database
  await jobLogger.startStep("save_recipe");
  const createdId = await createRecipeWithRefs(recipeId, userId, parseResult.recipe);

  if (!createdId) {
    await jobLogger.failStep("save_recipe", "Failed to save imported recipe");
    await jobLogger.fail("Failed to save imported recipe");
    throw new Error("Failed to save imported recipe");
  }

  await jobLogger.completeStep("save_recipe", { createdRecipeId: createdId });

  // Step 5: Post-processing (emit events, trigger follow-up jobs)
  await jobLogger.startStep("post_processing");
  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info(
      { jobId: job.id, recipeId: createdId, url, usedAI: parseResult.usedAI },
      "Recipe imported successfully"
    );

    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
      toast: parseResult.usedAI ? "imported" : undefined,
    });

    // Trigger auto-tagging only if AI was NOT used for extraction
    if (!parseResult.usedAI) {
      const queues = getQueues();

      await addAutoTaggingJob(queues.autoTagging, {
        recipeId: createdId,
        userId,
        householdKey,
      });

      await addAllergyDetectionJob(queues.allergyDetection, {
        recipeId: createdId,
        userId,
        householdKey,
      });

      if (!parseResult.recipe.categories?.length) {
        await addAutoCategorizationJob(queues.autoCategorization, {
          recipeId: createdId,
          userId,
          householdKey,
        });
      }
    }
  }

  await jobLogger.completeStep("post_processing", {
    triggeredFollowUp: !parseResult.usedAI,
  });
  await jobLogger.complete({
    recipeId: createdId,
    title: parseResult.recipe.title,
    usedAI: parseResult.usedAI,
  });
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

  // Log failure to job_logs (find existing log by jobId)
  if (isFinalFailure) {
    const { findJobLogByJobId, markJobFailed: markFailed } = await import(
      "@norish/db/repositories/job-logs"
    );
    const existingLog = await findJobLogByJobId(job.id!, QUEUE_NAMES.RECIPE_IMPORT);

    if (existingLog) {
      await markFailed(existingLog.id, error.message || "Unknown error");
    }
  }

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
  const rawProcessor = (job: Job<RecipeImportJobData>) =>
    withTimeout(
      () => processImportJob(job),
      RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
      "Recipe import job"
    );

  await createLazyWorker<RecipeImportJobData>(
    QUEUE_NAMES.RECIPE_IMPORT,
    rawProcessor,
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
