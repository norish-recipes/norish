/**
 * Image Import Worker
 *
 * Processes image-based recipe import jobs from the queue.
 * Uses AI vision models to extract recipe data from images.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";
import type { ImageImportBatchErrorCode } from "@norish/shared/contracts";
import {
  addRecipeImages,
  dashboardRecipe,
  getRecipeOwnerId,
  updateRecipeDishColor,
} from "@norish/db";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createResolvedRecipe } from "@norish/shared-server/ingredients/recipe-lines";
import { createLogger } from "@norish/shared-server/logger";
import { dishColorForImageUrl } from "@norish/shared-server/media/dish-color";
import { deleteRecipeImagesDir, saveImageBytes } from "@norish/shared-server/media/storage";
import { recipes } from "@norish/shared-server/realtime/recipes";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { announceUsableRecipe } from "../enrichment/announce";
import { reportStep } from "../job-steps";
import { getQueues } from "../registry";
import { settleImageImportBatchItem } from "./batch";

const log = createLogger("worker:image-import");

async function settleBatchItem(
  job: Job<ImageImportJobData>,
  outcome: { recipeId: string } | { errorCode: ImageImportBatchErrorCode }
): Promise<void> {
  const { batchId, batchItemId } = job.data;

  if (!batchId || !batchItemId) return;

  await settleImageImportBatchItem(getQueues().imageImport, {
    batchId,
    itemId: batchItemId,
    ...outcome,
  });
}

/**
 * Process a single image import job.
 */
export async function processImageImportJob(job: Job<ImageImportJobData>): Promise<void> {
  const extractRecipeFromImages = requireQueueApiHandler("extractRecipeFromImages");
  const { recipeId, userId, householdKey, householdUserIds, files, batchId } = job.data;

  log.info({ jobId: job.id, recipeId, fileCount: files.length }, "Processing image import job");

  if (batchId) {
    const existingOwner = await getRecipeOwnerId(recipeId);

    if (existingOwner && existingOwner !== userId) {
      throw new Error("Bulk image import recipe belongs to another user");
    }

    if (existingOwner) {
      const policy = await getRecipePermissionPolicy();
      const recovered = await dashboardRecipe(recipeId);

      if (recovered) {
        void recipes.publish(
          "imported",
          {
            recipe: recovered,
            pendingRecipeId: recipeId,
            toast: "imported",
          },
          { viewPolicy: policy.view, userId, householdKey }
        );
      }

      await settleBatchItem(job, { recipeId });

      return;
    }
  }

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx = { userId, householdKey };

  // Emit import started event (shows skeleton)
  void recipes.publish(
    "importStarted",
    {
      recipeId,
      url: `[${files.length} image(s)]`,
    },
    { viewPolicy: viewPolicy, ...ctx }
  );

  const parsedRecipe = await extractRecipeFromImages(recipeId, files);

  if (batchId) {
    parsedRecipe.url = null;
  }

  await reportStep(job, "saving");
  const created = await createResolvedRecipe(recipeId, userId, parsedRecipe, { userId });

  if (!created) {
    throw new Error("Failed to save imported recipe");
  }

  if (batchId && created.status === "existing") {
    throw new UnrecoverableError("Bulk image import recipe already exists");
  }

  const createdId = created.recipeId;

  // Save the first uploaded image as the recipe image
  if (files.length > 0) {
    const firstFile = files[0];

    if (firstFile) {
      try {
        const imageBytes = Buffer.from(firstFile.data, "base64");
        const imagePath = await saveImageBytes(imageBytes, recipeId);

        await addRecipeImages(createdId, [{ image: imagePath, order: 0 }]);
        // Vision imports store their primary image only here, after the
        // recipe row exists, so the Dish Colour is written the same way.
        await updateRecipeDishColor(createdId, await dishColorForImageUrl(imagePath));
        log.debug({ recipeId: createdId }, "Saved first uploaded image as recipe image");
      } catch (imageError) {
        // Log but don't fail the import if image saving fails
        log.warn({ err: imageError, recipeId: createdId }, "Failed to save uploaded image");
      }
    }
  }

  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info({ jobId: job.id, recipeId: createdId }, "Image recipe imported successfully");

    // Emit imported event (replaces skeleton with actual recipe)
    // Image import is always AI-based, so no processing will follow - show imported toast
    void recipes.publish(
      "imported",
      {
        recipe: dashboardDto,
        pendingRecipeId: recipeId,
        toast: "imported",
      },
      { viewPolicy: viewPolicy, ...ctx }
    );
  }

  await settleBatchItem(job, { recipeId: createdId });

  await announceUsableRecipe(created, { userId, householdKey, householdUserIds });
}

/**
 * Handle job failure.
 */
export async function handleImageImportJobFailed(
  job: Job<ImageImportJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId, userId, householdKey, files, batchId } = job.data;
  const maxAttempts = job.opts.attempts;
  const isFinalFailure =
    (maxAttempts !== undefined && job.attemptsMade >= maxAttempts) ||
    error instanceof UnrecoverableError;
  const existingOwner = batchId ? await getRecipeOwnerId(recipeId) : null;
  const recipeLanded = existingOwner === userId;

  log.error(
    {
      jobId: job.id,
      recipeId,
      fileCount: files.length,
      attempt: job.attemptsMade,
      maxAttempts,
      isFinalFailure,
      error: error.message,
    },
    "Image import job failed"
  );

  const publishFailure = async (): Promise<void> => {
    const policy = await getRecipePermissionPolicy();
    const ctx = { userId, householdKey };

    void recipes.publish(
      "failed",
      {
        reason: error.message || "Failed to import recipe from images",
        recipeId,
        url: `[${files.length} image(s)]`,
      },
      { viewPolicy: policy.view, ...ctx }
    );
  };

  if (!batchId) {
    await deleteRecipeImagesDir(recipeId);
    await publishFailure();

    return;
  }

  if (!isFinalFailure) return;

  if (!recipeLanded) {
    if (existingOwner === null) {
      await deleteRecipeImagesDir(recipeId);
    }

    await publishFailure();
  }

  try {
    await job.updateData({ ...job.data, files: [] });
  } catch (updateError) {
    log.warn(
      { err: updateError, jobId: job.id },
      "Could not clear the failed image import payload"
    );
  }

  await settleBatchItem(job, recipeLanded ? { recipeId } : { errorCode: "extraction-failed" });
}

/**
 * Start the image import worker (lazy - starts on demand).
 */
const imageImportWorker = defineLazyWorker(
  QUEUE_NAMES.IMAGE_IMPORT,
  processImageImportJob,
  handleImageImportJobFailed
);

export const startImageImportWorker = imageImportWorker.start;
export const stopImageImportWorker = imageImportWorker.stop;
