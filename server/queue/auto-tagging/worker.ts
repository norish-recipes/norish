/**
 * Auto-Tagging Worker
 *
 * Processes auto-tagging jobs from the queue.
 * Generates AI-based tags for recipes that were imported via structured parsers.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { AutoTaggingJobData } from "@/types";
import type { Job } from "bullmq";

import { QUEUE_NAMES, baseWorkerOptions, WORKER_CONCURRENCY, STALLED_INTERVAL } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

import { getBullClient } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";
import { emitByPolicy, type PolicyEmitContext } from "@/server/trpc/helpers";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import { getRecipeFull } from "@/server/db";
import { attachTagsToRecipeByInputTx, getRecipeTagNamesTx } from "@/server/db/repositories/tags";
import { db } from "@/server/db/drizzle";
import { generateTagsForRecipe } from "@/server/ai/auto-tagger";

const log = createLogger("worker:auto-tagging");

async function processAutoTaggingJob(job: Job<AutoTaggingJobData>): Promise<void> {
  const { recipeId, userId, householdKey } = job.data;

  log.info(
    { jobId: job.id, recipeId, attempt: job.attemptsMade + 1 },
    "Processing auto-tagging job"
  );

  const policy = await getRecipePermissionPolicy();
  const ctx: PolicyEmitContext = { userId, householdKey };

  // Emit autoTaggingStarted event so clients can show loading state
  emitByPolicy(recipeEmitter, policy.view, ctx, "autoTaggingStarted", { recipeId });

  // Emit toast with i18n key - client just shows it directly
  emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
    recipeId,
    titleKey: "processingTags",
    severity: "default",
  });

  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  if (recipe.recipeIngredients.length === 0) {
    log.warn({ recipeId }, "Recipe has no ingredients, skipping auto-tagging");
    emitByPolicy(recipeEmitter, policy.view, ctx, "autoTaggingCompleted", { recipeId });
    emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
      recipeId,
      titleKey: "tagsComplete",
      severity: "success",
    });

    return;
  }

  // Prepare recipe data for AI tagging
  const recipeForTagging = {
    title: recipe.name,
    description: recipe.description,
    ingredients: recipe.recipeIngredients.map((ri) => ri.ingredientName),
  };

  const result = await generateTagsForRecipe(recipeForTagging);

  if (!result.success) {
    throw new Error(result.error);
  }

  const generatedTags = result.data;

  if (generatedTags.length === 0) {
    log.info({ recipeId }, "AI returned no tags");
    emitByPolicy(recipeEmitter, policy.view, ctx, "autoTaggingCompleted", { recipeId });
    emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
      recipeId,
      titleKey: "tagsComplete",
      severity: "success",
    });

    return;
  }

  // Update recipe tags in database (within transaction to avoid race conditions)
  await db.transaction(async (tx) => {
    // Get existing tags to merge (preserve any manually added tags)
    const existingTags = await getRecipeTagNamesTx(tx, recipeId);

    // Merge tags: AI tags + existing tags (deduplicated, lowercase comparison)
    const existingLower = new Set(existingTags.map((t: string) => t.toLowerCase()));
    const newTags = generatedTags.filter((t) => !existingLower.has(t.toLowerCase()));
    const allTags = [...existingTags, ...newTags];

    await attachTagsToRecipeByInputTx(tx, recipeId, allTags);

    log.info(
      { jobId: job.id, recipeId, newTags, totalTags: allTags.length },
      "Auto-tagging completed and saved"
    );
  });

  // Fetch updated recipe and emit events
  const updatedRecipe = await getRecipeFull(recipeId);

  if (updatedRecipe) {
    emitByPolicy(recipeEmitter, policy.view, ctx, "updated", { recipe: updatedRecipe });
  }

  // Emit completion event so clients can track when auto-tagging is done
  emitByPolicy(recipeEmitter, policy.view, ctx, "autoTaggingCompleted", { recipeId });

  // Emit toast with i18n key for completion
  emitByPolicy(recipeEmitter, policy.view, ctx, "processingToast", {
    recipeId,
    titleKey: "tagsComplete",
    severity: "success",
  });
}

async function handleJobFailed(
  job: Job<AutoTaggingJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;
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
    "Auto-tagging job failed"
  );

  // Note: We don't emit a "failed" event for auto-tagging failures
  // since it's a background enhancement, not a user-initiated action
}

export async function startAutoTaggingWorker(): Promise<void> {
  await createLazyWorker<AutoTaggingJobData>(
    QUEUE_NAMES.AUTO_TAGGING,
    processAutoTaggingJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.AUTO_TAGGING],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.AUTO_TAGGING],
    },
    handleJobFailed
  );
}

export async function stopAutoTaggingWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.AUTO_TAGGING);
}
