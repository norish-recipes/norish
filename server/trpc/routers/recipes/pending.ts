import type {
  RecipeImportJobData,
  PendingRecipeDTO,
  NutritionEstimationJobData,
  AutoTaggingJobData,
  AllergyDetectionJobData,
  AutoCategorizationJobData,
} from "@/types";
import type { Job } from "bullmq";

import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { getQueues } from "@/server/queue/registry";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";

const getPending = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Fetching pending recipe imports");

  const policy = await getRecipePermissionPolicy();
  const queues = getQueues();

  const jobs = await queues.recipeImport.getJobs(["waiting", "active", "delayed"]);

  const filteredJobs = jobs.filter((job: Job<RecipeImportJobData>) => {
    const data = job.data;

    switch (policy.view) {
      case "everyone":
        // Everyone can see all pending imports
        return true;
      case "household":
        // User can only see jobs from their household
        return data.householdKey === ctx.householdKey;
      case "owner":
        // User can only see their own jobs
        return data.userId === ctx.user.id;
    }

    return false;
  });

  const pendingRecipes: PendingRecipeDTO[] = filteredJobs.map((job: Job<RecipeImportJobData>) => ({
    recipeId: job.data.recipeId,
    url: job.data.url,
    addedAt: job.timestamp,
  }));

  log.debug({ userId: ctx.user.id, count: pendingRecipes.length }, "Found pending recipe imports");

  return pendingRecipes;
});

/**
 * Check if a specific recipe has a pending nutrition estimation job.
 */
const isNutritionEstimating = authedProcedure
  .input(z.object({ recipeId: z.uuid() }))
  .query(async ({ ctx, input }) => {
    const queues = getQueues();
    const jobs = await queues.nutritionEstimation.getJobs(["waiting", "active", "delayed"]);

    const isEstimating = jobs.some((job: Job<NutritionEstimationJobData>) => {
      return job.data.recipeId === input.recipeId;
    });

    log.debug(
      { userId: ctx.user.id, recipeId: input.recipeId, isEstimating },
      "Checked nutrition estimation status"
    );

    return isEstimating;
  });

/**
 * Get all recipe IDs that have pending auto-tagging jobs.
 * Used to hydrate the auto-tagging state on page load.
 */
const getPendingAutoTagging = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Fetching pending auto-tagging jobs");

  const queues = getQueues();
  const jobs = await queues.autoTagging.getJobs(["waiting", "active", "delayed"]);

  // Auto-tagging jobs are per-recipe and user-scoped
  const recipeIds = jobs
    .filter(
      (job: Job<AutoTaggingJobData>) =>
        job.data.userId === ctx.user.id || job.data.householdKey === ctx.householdKey
    )
    .map((job: Job<AutoTaggingJobData>) => job.data.recipeId);

  log.debug({ userId: ctx.user.id, count: recipeIds.length }, "Found pending auto-tagging jobs");

  return recipeIds;
});

/**
 * Check if a specific recipe has a pending auto-tagging job.
 */
const isAutoTagging = authedProcedure
  .input(z.object({ recipeId: z.uuid() }))
  .query(async ({ ctx, input }) => {
    const queues = getQueues();
    const jobs = await queues.autoTagging.getJobs(["waiting", "active", "delayed"]);

    const isActive = jobs.some(
      (job: Job<AutoTaggingJobData>) => job.data.recipeId === input.recipeId
    );

    log.debug(
      { userId: ctx.user.id, recipeId: input.recipeId, isActive },
      "Checked auto-tagging status"
    );

    return isActive;
  });

const isAutoCategorizing = authedProcedure
  .input(z.object({ recipeId: z.uuid() }))
  .query(async ({ ctx, input }) => {
    const queues = getQueues();
    const jobs = await queues.autoCategorization.getJobs(["waiting", "active", "delayed"]);

    const isActive = jobs.some(
      (job: Job<AutoCategorizationJobData>) => job.data.recipeId === input.recipeId
    );

    log.debug(
      { userId: ctx.user.id, recipeId: input.recipeId, isActive },
      "Checked auto-categorization status"
    );

    return isActive;
  });

/**
 * Get all recipe IDs that have pending allergy detection jobs.
 * Used to hydrate the allergy detection state on page load.
 */
const getPendingAllergyDetection = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Fetching pending allergy detection jobs");

  const queues = getQueues();
  const jobs = await queues.allergyDetection.getJobs(["waiting", "active", "delayed"]);

  // Allergy detection jobs are per-recipe and user-scoped
  const recipeIds = jobs
    .filter((job: Job<AllergyDetectionJobData>) => {
      return job.data.userId === ctx.user.id || job.data.householdKey === ctx.householdKey;
    })
    .map((job: Job<AllergyDetectionJobData>) => job.data.recipeId);

  log.debug(
    { userId: ctx.user.id, count: recipeIds.length },
    "Found pending allergy detection jobs"
  );

  return recipeIds;
});

/**
 * Check if a specific recipe has a pending allergy detection job.
 */
const isAllergyDetecting = authedProcedure
  .input(z.object({ recipeId: z.uuid() }))
  .query(async ({ ctx, input }) => {
    const queues = getQueues();
    const jobs = await queues.allergyDetection.getJobs(["waiting", "active", "delayed"]);

    const isActive = jobs.some((job: Job<AllergyDetectionJobData>) => {
      return job.data.recipeId === input.recipeId;
    });

    log.debug(
      { userId: ctx.user.id, recipeId: input.recipeId, isActive },
      "Checked allergy detection status"
    );

    return isActive;
  });

export const pendingProcedures = router({
  getPending,
  isNutritionEstimating,
  getPendingAutoTagging,
  isAutoTagging,
  isAutoCategorizing,
  getPendingAllergyDetection,
  isAllergyDetecting,
});
