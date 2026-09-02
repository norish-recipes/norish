/**
 * Recipe Import Worker
 *
 * Processes recipe import jobs from the queue.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";
import type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
import { createRecipeWithRefs, dashboardRecipe, recipeExistsByUrlForPolicy } from "@norish/db";
import { getDecryptedTokensByUserId } from "@norish/db/repositories/site-auth-tokens";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { withDishColor } from "@norish/shared-server/media/dish-color";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { emitByPolicy } from "@norish/shared-server/realtime/policy";
import { recipeEmitter } from "@norish/shared-server/realtime/recipes";
import { credentialSetsForUrl, rotateCredentialSet } from "@norish/shared/lib/site-auth-tokens";

import { defineLazyWorker, QUEUE_NAMES, RECIPE_IMPORT_PROCESSING_TIMEOUT_MS } from "../config";
import { announceUsableRecipe } from "../enrichment/announce";
import { withTimeout } from "../helpers";
import { completeStep, reportStep } from "../job-steps";

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

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  // Emit import started event
  emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", { recipeId, url });

  // Check if recipe already exists (policy-aware)
  await reportStep(job, "dedupe-check");
  const existingCheck = await recipeExistsByUrlForPolicy(url, userId, householdUserIds, viewPolicy);

  await completeStep(job, { alreadyExists: existingCheck.exists });

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

  // No allergy list is fetched here: extraction reads the source, and allergy
  // detection runs afterwards as its own enrichment kind.

  // One site login per import, and the job records which: an import that dies
  // on an expired or rate-limited account has to be able to name it.
  const sets = credentialSetsForUrl(await getDecryptedTokensByUserId(userId), url);
  const credentials = rotateCredentialSet(sets);

  await reportStep(
    job,
    "parsing",
    credentials ? { siteAuth: { account: credentials.account, ofAccounts: sets.length } } : undefined
  );
  const parseResult = await withTimeout(
    () => parseRecipeFromUrl(url, recipeId, job.data.forceAI, credentials?.tokens),
    RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
    "Recipe import parsing"
  );

  log.debug({ parseResult }, "Recipe parse result");
  if (!parseResult.recipe) {
    throw new Error("Failed to parse recipe from URL");
  }

  await completeStep(job, { usedAI: parseResult.usedAI });

  await reportStep(job, "saving");
  // The Dish Colour is taken from the image the import just stored.
  const created = await createRecipeWithRefs(
    recipeId,
    userId,
    await withDishColor(parseResult.recipe)
  );
  const createdId = created?.recipeId;

  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info(
      { jobId: job.id, recipeId: createdId, url, usedAI: parseResult.usedAI },
      "Recipe imported successfully"
    );

    // Import success is terminal here: enrichment is enrolled independently and
    // cannot roll it back, delay it, or change the toast the user sees.
    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
      toast: "imported",
    });
  }

  await announceUsableRecipe(created, { userId, householdKey, householdUserIds });
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
// Exported for tests, like the other import workers' processors.
export const processRecipeImportJob = (job: Job<RecipeImportJobData>) =>
  withTimeout(
    () => processImportJob(job),
    RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
    "Recipe import job"
  );

const recipeImportWorker = defineLazyWorker(
  QUEUE_NAMES.RECIPE_IMPORT,
  processRecipeImportJob,
  handleJobFailed
);

export const startRecipeImportWorker = recipeImportWorker.start;
export const stopRecipeImportWorker = recipeImportWorker.stop;
