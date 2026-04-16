/**
 * Paste Import Worker
 *
 * Processes pasted recipe text or pasted JSON-LD.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type {
  PasteImportJobData,
  PasteImportJobResult,
  StructuredPasteImportRecipe,
} from "@norish/queue/contracts/job-types";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts";
import type { PolicyEmitContext } from "@norish/trpc/helpers";
import {
  getAIConfig,
  getRecipePermissionPolicy,
  isAIEnabled,
} from "@norish/config/server-config-loader";
import { createRecipeWithRefs, dashboardRecipe, getAllergiesForUsers } from "@norish/db";
import { getAverageRating, rateRecipe } from "@norish/db/repositories/ratings";
import { addAllergyDetectionJob } from "@norish/queue/allergy-detection/producer";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { addAutoTaggingJob } from "@norish/queue/auto-tagging/producer";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { getQueues } from "@norish/queue/registry";
import { createLogger } from "@norish/shared-server/logger";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";
import { FullRecipeInsertSchema } from "@norish/shared/contracts/zod";
import { hasRecipeNameIngredientsAndSteps } from "@norish/shared/lib/helpers";
import { emitByPolicy } from "@norish/trpc/helpers";
import { recipeEmitter } from "@norish/trpc/routers/recipes/emitter";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:paste-import");

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface ParseResult {
  recipe: FullRecipeInsertDTO;
  usedAI: boolean;
}

async function parseFromPastedText(
  text: string,
  recipeId: string,
  allergies?: string[],
  forceAI?: boolean
): Promise<ParseResult> {
  const extractRecipeWithAI = requireQueueApiHandler("extractRecipeWithAI");
  const trimmed = text.trim();

  if (!trimmed) throw new Error("No text provided");
  if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
    throw new Error(`Paste is too large (max ${MAX_RECIPE_PASTE_CHARS} characters per recipe)`);
  }

  const aiEnabled = await isAIEnabled();

  if (forceAI) {
    if (!aiEnabled) {
      throw new Error("AI-only import requested but AI is not enabled.");
    }

    const html = `<html><body><main><h1>Pasted recipe</h1><p>${escapeHtml(trimmed)}</p></main></body></html>`;
    const ai = await extractRecipeWithAI(html, recipeId, undefined, allergies);

    if (ai.success && hasRecipeNameIngredientsAndSteps(ai.data)) {
      return { recipe: ai.data, usedAI: true };
    }

    throw new Error("Could not parse pasted recipe.");
  }

  if (!aiEnabled) {
    throw new Error("Could not parse pasted recipe. Try pasting JSON-LD, or enable AI import.");
  }

  const html = `<html><body><main><h1>Pasted recipe</h1><p>${escapeHtml(trimmed)}</p></main></body></html>`;
  const ai = await extractRecipeWithAI(html, recipeId, undefined, allergies);

  if (ai.success && hasRecipeNameIngredientsAndSteps(ai.data)) {
    return { recipe: ai.data, usedAI: true };
  }

  throw new Error("Could not parse pasted recipe.");
}

function normalizeImportedRating(rating: number | null): number | null {
  if (rating == null || !Number.isFinite(rating)) {
    return null;
  }

  return Math.min(5, Math.max(1, Math.round(rating)));
}

async function persistImportedRating(
  userId: string,
  recipeId: string,
  rating: number | null
): Promise<void> {
  const normalizedRating = normalizeImportedRating(rating);

  if (normalizedRating == null) {
    return;
  }

  await rateRecipe(userId, recipeId, normalizedRating);
  const stats = await getAverageRating(recipeId);

  log.debug({ recipeId, rating: normalizedRating, stats }, "Imported rating persisted");
}

async function createStructuredRecipe(
  structuredRecipe: StructuredPasteImportRecipe,
  userId: string,
  _householdKey: string
): Promise<string | null> {
  const parsed = FullRecipeInsertSchema.safeParse(structuredRecipe.recipe);

  if (!parsed.success || !hasRecipeNameIngredientsAndSteps(parsed.data)) {
    return null;
  }

  const createdId = await createRecipeWithRefs(structuredRecipe.recipeId, userId, parsed.data);

  if (!createdId) {
    return null;
  }

  await persistImportedRating(userId, createdId, structuredRecipe.importedRating);

  return createdId;
}

export async function processPasteImportJob(
  job: Job<PasteImportJobData>
): Promise<PasteImportJobResult> {
  const { recipeIds, structuredRecipes, userId, householdKey, householdUserIds, text, forceAI } =
    job.data;

  log.info(
    { jobId: job.id, recipeIds, attempt: job.attemptsMade + 1 },
    "Processing paste import job"
  );

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  recipeIds.forEach((recipeId) => {
    emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", {
      recipeId,
      url: "[pasted]",
    });
  });

  const aiConfig = await getAIConfig();
  let allergyNames: string[] | undefined;

  if (aiConfig?.autoTagAllergies) {
    const householdAllergies = await getAllergiesForUsers(householdUserIds ?? [userId]);

    allergyNames = [...new Set(householdAllergies.map((a) => a.tagName))];
    log.debug(
      { allergyCount: allergyNames.length },
      "Fetched household allergies for paste import"
    );
  }

  const createdRecipeIds: string[] = [];

  if (structuredRecipes && structuredRecipes.length > 0) {
    for (const structuredRecipe of structuredRecipes) {
      const createdId = await createStructuredRecipe(structuredRecipe, userId, householdKey);

      if (!createdId) {
        continue;
      }

      createdRecipeIds.push(createdId);
    }

    if (createdRecipeIds.length === 0) {
      throw new Error("No valid recipes found in structured paste input.");
    }
  } else {
    const recipeId = recipeIds[0];

    if (!recipeId) {
      throw new Error("Missing recipe ID for paste import.");
    }

    const parseResult = await parseFromPastedText(text, recipeId, allergyNames, forceAI);
    const createdId = await createRecipeWithRefs(recipeId, userId, parseResult.recipe);

    if (!createdId) {
      throw new Error("Failed to save imported recipe");
    }

    createdRecipeIds.push(createdId);
  }

  const queues = getQueues();

  for (const createdId of createdRecipeIds) {
    const dashboardDto = await dashboardRecipe(createdId);

    if (!dashboardDto) {
      continue;
    }

    const usedAI = !structuredRecipes || structuredRecipes.length === 0;

    log.info({ jobId: job.id, recipeId: createdId, usedAI }, "Pasted recipe imported successfully");

    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: createdId,
      toast: usedAI ? "imported" : undefined,
    });

    if (!usedAI) {
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
    }
  }

  return { recipeIds: createdRecipeIds };
}

async function handleJobFailed(
  job: Job<PasteImportJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeIds, userId, householdKey } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;
  const isFinalFailure = job.attemptsMade >= maxAttempts;

  log.error(
    {
      jobId: job.id,
      recipeIds,
      attempt: job.attemptsMade,
      maxAttempts,
      isFinalFailure,
      error: error.message,
    },
    "Paste import job failed"
  );

  await Promise.all(recipeIds.map((recipeId) => deleteRecipeImagesDir(recipeId)));

  if (isFinalFailure) {
    const policy = await getRecipePermissionPolicy();
    const ctx: PolicyEmitContext = { userId, householdKey };

    recipeIds.forEach((recipeId) => {
      emitByPolicy(recipeEmitter, policy.view, ctx, "failed", {
        reason: error.message || "Failed to import recipe",
        recipeId,
        url: "[pasted]",
      });
    });
  }
}

export async function startPasteImportWorker(): Promise<void> {
  await createLazyWorker<PasteImportJobData>(
    QUEUE_NAMES.PASTE_IMPORT,
    processPasteImportJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.PASTE_IMPORT],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.PASTE_IMPORT],
    },
    handleJobFailed
  );
}

export async function stopPasteImportWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.PASTE_IMPORT);
}
