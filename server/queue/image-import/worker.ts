/**
 * Image Import Worker
 *
 * Processes image-based recipe import jobs from the queue.
 * Uses AI vision models to extract recipe data from images.
 */

import type { ImageImportJobData } from "@/types";

import { Worker, Job } from "bullmq";

import { redisConnection, QUEUE_NAMES } from "../config";

import { createLogger } from "@/server/logger";
import { emitByPolicy, type PolicyEmitContext } from "@/server/trpc/helpers";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getRecipePermissionPolicy, getAIConfig } from "@/config/server-config-loader";
import { createRecipeWithRefs, dashboardRecipe, getAllergiesForUsers } from "@/server/db";
import { extractRecipeFromImages } from "@/server/ai/image-recipe-parser";

const log = createLogger("worker:image-import");

let worker: Worker<ImageImportJobData> | null = null;

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
  const parsedRecipe = await extractRecipeFromImages(files, allergyNames);

  if (!parsedRecipe) {
    throw new Error(
      "Failed to extract recipe from images. The images may not contain a valid recipe."
    );
  }

  // Save the recipe
  const createdId = await createRecipeWithRefs(recipeId, userId, parsedRecipe);

  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info({ jobId: job.id, recipeId: createdId }, "Image recipe imported successfully");

    // Emit imported event (replaces skeleton with actual recipe)
    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
    });
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
 * Start the image import worker.
 */
export function startImageImportWorker(): void {
  if (worker) {
    log.warn("Image import worker already running");

    return;
  }

  worker = new Worker<ImageImportJobData>(QUEUE_NAMES.IMAGE_IMPORT, processImageImportJob, {
    connection: redisConnection,
    concurrency: 2, // Lower concurrency due to heavier AI load
  });

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Image import job completed");
  });

  worker.on("failed", (job, error) => {
    handleJobFailed(job, error);
  });

  worker.on("error", (error) => {
    log.error({ error }, "Image import worker error");
  });

  log.info("Image import worker started");
}

export async function stopImageImportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("Image import worker stopped");
  }
}
