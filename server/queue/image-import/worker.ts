/**
 * Image Import Worker
 *
 * Processes image-based recipe import jobs from the queue.
 * Uses AI vision models to extract recipe data from images.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { ImageImportJobData } from "@/types";
import type { Job } from "bullmq";

import { QUEUE_NAMES, baseWorkerOptions, WORKER_CONCURRENCY, STALLED_INTERVAL } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

import { getBullClient } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";
import { emitByPolicy, type PolicyEmitContext } from "@/server/trpc/helpers";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getRecipePermissionPolicy, getAIConfig } from "@/config/server-config-loader";
import {
  createRecipeWithRefs,
  dashboardRecipe,
  getAllergiesForUsers,
  addRecipeImages,
} from "@/server/db";
import { extractRecipeFromImages } from "@/server/ai/image-recipe-parser";
import { saveImageBytes } from "@/server/downloader";

const log = createLogger("worker:image-import");

/**
 * Process a single image import job.
 */
async function processImageImportJob(job: Job<ImageImportJobData>): Promise<void> {
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

  // Fetch household allergies for targeted allergy detection
  const aiConfig = await getAIConfig();
  let allergyNames: string[] | undefined;

  if (aiConfig?.autoTagAllergies) {
    const householdAllergies = await getAllergiesForUsers(householdUserIds ?? [userId]);

    allergyNames = [...new Set(householdAllergies.map((a) => a.tagName))];
    log.debug(
      { allergyCount: allergyNames.length },
      "Fetched household allergies for image import"
    );
  }

  // Extract recipe from images using AI vision
  const result = await extractRecipeFromImages(files, allergyNames);

  if (!result.success) {
    throw new Error(
      result.error ||
        "Failed to extract recipe from images. The images may not contain a valid recipe."
    );
  }

  const parsedRecipe = result.data;

  // Save the recipe
  const createdId = await createRecipeWithRefs(recipeId, userId, parsedRecipe);

  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  // Save the first uploaded image as the recipe image
  if (files.length > 0) {
    const firstFile = files[0];

    try {
      const imageBytes = Buffer.from(firstFile.data, "base64");
      const imagePath = await saveImageBytes(imageBytes, firstFile.filename);

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

    // Note: No auto-tagging job queued - image import is always AI-based,
    // and AI extraction prompts already include auto-tagging instructions
  }
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
