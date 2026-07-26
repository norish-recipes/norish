/**
 * Image Import Worker
 *
 * Processes image-based recipe import jobs from the queue.
 * Uses AI vision models to extract recipe data from images.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";
import type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
import { addRecipeImages, createRecipeWithRefs, dashboardRecipe } from "@norish/db";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { deleteRecipeImagesDir, saveImageBytes } from "@norish/shared-server/media/storage";
import { emitByPolicy } from "@norish/shared-server/realtime/policy";
import { recipeEmitter } from "@norish/shared-server/realtime/recipes";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { announceUsableRecipe } from "../enrichment/announce";
import { reportStep } from "../job-steps";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:image-import");

/**
 * Process a single image import job.
 */
export async function processImageImportJob(job: Job<ImageImportJobData>): Promise<void> {
  const extractRecipeFromImages = requireQueueApiHandler("extractRecipeFromImages");
  const { recipeId, userId, householdKey, householdUserIds, files } = job.data;

  log.info({ jobId: job.id, recipeId, fileCount: files.length }, "Processing image import job");

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  // Emit import started event (shows skeleton)
  emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", {
    recipeId,
    url: `[${files.length} image(s)]`,
  });

  // Vision parsing reads the images; every inference happens afterwards.
  const result = await extractRecipeFromImages(recipeId, files);

  if (!result.success) {
    throw new Error(
      result.error ||
        "Failed to extract recipe from images. The images may not contain a valid recipe."
    );
  }

  const parsedRecipe = result.data;

  // Save the recipe
  await reportStep(job, "saving");
  const created = await createRecipeWithRefs(recipeId, userId, parsedRecipe);
  const createdId = created?.recipeId;

  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  // Save the first uploaded image as the recipe image
  if (files.length > 0) {
    const firstFile = files[0];

    if (!firstFile) {
      return;
    }

    try {
      const imageBytes = Buffer.from(firstFile.data, "base64");
      const imagePath = await saveImageBytes(imageBytes, recipeId);

      await addRecipeImages(createdId, [{ image: imagePath, order: 0 }]);
      log.debug({ recipeId: createdId }, "Saved first uploaded image as recipe image");
    } catch (imageError) {
      // Log but don't fail the import if image saving fails
      log.warn({ err: imageError, recipeId: createdId }, "Failed to save uploaded image");
    }
  }

  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info({ jobId: job.id, recipeId: createdId }, "Image recipe imported successfully");

    // Emit imported event (replaces skeleton with actual recipe)
    // Image import is always AI-based, so no processing will follow - show imported toast
    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
      toast: "imported",
    });
  }

  // Vision parsing is a reader, not an inference step: an image import enters
  // the same enrichment flow as every other creation path.
  await announceUsableRecipe(created, { userId, householdKey, householdUserIds });
}

/**
 * Handle job failure.
 */
async function handleJobFailed(
  job: Job<ImageImportJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId, userId, householdKey, files } = job.data;

  log.error(
    {
      jobId: job.id,
      recipeId,
      fileCount: files.length,
      error: error.message,
    },
    "Image import job failed"
  );

  await deleteRecipeImagesDir(recipeId);

  // Emit failed event (removes skeleton)
  const policy = await getRecipePermissionPolicy();
  const ctx: PolicyEmitContext = { userId, householdKey };

  emitByPolicy(recipeEmitter, policy.view, ctx, "failed", {
    reason: error.message || "Failed to import recipe from images",
    recipeId,
    url: `[${files.length} image(s)]`,
  });
}

/**
 * Start the image import worker (lazy - starts on demand).
 */
export async function startImageImportWorker(): Promise<void> {
  await createLazyWorker<ImageImportJobData>(
    QUEUE_NAMES.IMAGE_IMPORT,
    processImageImportJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.IMAGE_IMPORT],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.IMAGE_IMPORT],
    },
    handleJobFailed
  );
}

export async function stopImageImportWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.IMAGE_IMPORT);
}
