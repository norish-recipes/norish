/**
 * Image Import Worker
 *
 * Processes image-based recipe import jobs from the queue.
 * Uses AI vision models to extract recipe data from images.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";
import type { PolicyEmitContext } from "@norish/trpc/helpers";
import { getAIConfig, getRecipePermissionPolicy } from "@norish/config/server-config-loader";
import {
  addRecipeImages,
  createRecipeWithRefs,
  dashboardRecipe,
  getAllergiesForUsers,
} from "@norish/db";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { createLogger } from "@norish/shared-server/logger";
import { deleteRecipeImagesDir, saveImageBytes } from "@norish/shared-server/media/storage";
import { emitByPolicy } from "@norish/trpc/helpers";
import { recipeEmitter } from "@norish/trpc/routers/recipes/emitter";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { JobLogger } from "../job-logger";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:image-import");

/**
 * Process a single image import job.
 */
export async function processImageImportJob(job: Job<ImageImportJobData>): Promise<void> {
  const extractRecipeFromImages = requireQueueApiHandler("extractRecipeFromImages");
  const { recipeId, userId, householdKey, householdUserIds, files } = job.data;

  log.info({ jobId: job.id, recipeId, fileCount: files.length }, "Processing image import job");

  // Create job logger
  const jobLogger = await JobLogger.create({
    jobId: job.id!,
    queueName: QUEUE_NAMES.IMAGE_IMPORT,
    userId,
    recipeId,
    description: `${files.length} image(s)`,
    input: { fileCount: files.length, filenames: files.map((f) => f.filename) },
    steps: ["fetch_allergies", "ai_extraction", "save_recipe", "save_image", "emit_result"],
  });

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  // Emit import started event (shows skeleton)
  emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", {
    recipeId,
    url: `[${files.length} image(s)]`,
  });

  // Step 1: Fetch household allergies
  await jobLogger.startStep("fetch_allergies");
  const aiConfig = await getAIConfig();
  let allergyNames: string[] | undefined;

  if (aiConfig?.autoTagAllergies) {
    const householdAllergies = await getAllergiesForUsers(householdUserIds ?? [userId]);

    allergyNames = [...new Set(householdAllergies.map((a) => a.tagName))];
    log.debug(
      { allergyCount: allergyNames.length },
      "Fetched household allergies for image import"
    );
    await jobLogger.completeStep("fetch_allergies", { allergyCount: allergyNames.length });
  } else {
    await jobLogger.skipStep("fetch_allergies", "autoTagAllergies disabled");
  }

  // Step 2: AI extraction from images
  await jobLogger.startStep("ai_extraction");
  if (aiConfig?.model) {
    await jobLogger.setAiModel(aiConfig.model);
  }

  const result = await extractRecipeFromImages(recipeId, files, allergyNames);

  if (!result.success) {
    const errorMsg = result.error || "Failed to extract recipe from images.";
    await jobLogger.failStep("ai_extraction", errorMsg);
    await jobLogger.fail(errorMsg);
    throw new Error(errorMsg);
  }

  const parsedRecipe = result.data;
  await jobLogger.completeStep("ai_extraction", { title: parsedRecipe.title });

  // Step 3: Save the recipe
  await jobLogger.startStep("save_recipe");
  const createdId = await createRecipeWithRefs(recipeId, userId, parsedRecipe);

  if (!createdId) {
    await jobLogger.failStep("save_recipe", "Failed to save imported recipe");
    await jobLogger.fail("Failed to save imported recipe");
    throw new Error("Failed to save imported recipe");
  }
  await jobLogger.completeStep("save_recipe", { createdRecipeId: createdId });

  // Step 4: Save uploaded image as recipe image
  await jobLogger.startStep("save_image");
  if (files.length > 0) {
    const firstFile = files[0];

    if (firstFile) {
      try {
        const imageBytes = Buffer.from(firstFile.data, "base64");
        const imagePath = await saveImageBytes(imageBytes, recipeId);

        await addRecipeImages(createdId, [{ image: imagePath, order: 0 }]);
        log.debug({ recipeId: createdId }, "Saved first uploaded image as recipe image");
        await jobLogger.completeStep("save_image", { imagePath });
      } catch (imageError) {
        log.warn({ err: imageError, recipeId: createdId }, "Failed to save uploaded image");
        await jobLogger.failStep("save_image", "Failed to save uploaded image (non-fatal)");
      }
    } else {
      await jobLogger.skipStep("save_image", "No valid file");
    }
  } else {
    await jobLogger.skipStep("save_image", "No files provided");
  }

  // Step 5: Emit result
  await jobLogger.startStep("emit_result");
  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info({ jobId: job.id, recipeId: createdId }, "Image recipe imported successfully");

    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
      toast: "imported",
    });
  }

  await jobLogger.completeStep("emit_result");
  await jobLogger.complete({ recipeId: createdId, title: parsedRecipe.title });
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
