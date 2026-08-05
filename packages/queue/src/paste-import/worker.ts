/**
 * Paste Import Worker
 *
 * Processes pasted recipe text or pasted JSON-LD.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { CreateRecipeResult } from "@norish/db/repositories/recipes";
import type {
  PasteImportJobData,
  PasteImportJobResult,
  StructuredPasteImportRecipe,
} from "@norish/queue/contracts/job-types";
import type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts";
import { createRecipeWithRefs, dashboardRecipe } from "@norish/db";
import { getAverageRating, rateRecipe } from "@norish/db/repositories/ratings";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import {
  getRecipePermissionPolicy,
  isAIEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { emitByPolicy } from "@norish/shared-server/realtime/policy";
import { recipeEmitter } from "@norish/shared-server/realtime/recipes";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";
import { FullRecipeInsertSchema } from "@norish/shared/contracts/zod";
import { hasRecipeNameIngredientsAndSteps } from "@norish/shared/lib/helpers";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { announceUsableRecipe } from "../enrichment/announce";
import { completeStep, reportStep } from "../job-steps";

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
  forceAI?: boolean
): Promise<ParseResult> {
  const extractRecipeWithAI = requireQueueApiHandler("extractRecipeWithAI");
  const trimmed = text.trim();

  if (!trimmed) throw new Error("No text provided");
  if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
    throw new Error(`Paste is too large (max ${MAX_RECIPE_PASTE_CHARS} characters per recipe)`);
  }

  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    if (forceAI) {
      throw new Error("AI-only import requested but AI is not enabled.");
    }

    throw new Error("Could not parse pasted recipe. Try pasting JSON-LD, or enable AI import.");
  }

  const html = `<html><body><main><h1>Pasted recipe</h1><p>${escapeHtml(trimmed)}</p></main></body></html>`;

  try {
    const recipe = await extractRecipeWithAI(html, recipeId);

    if (hasRecipeNameIngredientsAndSteps(recipe)) {
      return { recipe, usedAI: true };
    }
  } catch (error) {
    log.warn({ recipeId, err: error }, "AI extraction of pasted text failed");
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
): Promise<CreateRecipeResult | null> {
  const parsed = FullRecipeInsertSchema.safeParse(structuredRecipe.recipe);

  if (!parsed.success || !hasRecipeNameIngredientsAndSteps(parsed.data)) {
    return null;
  }

  const created = await createRecipeWithRefs(structuredRecipe.recipeId, userId, parsed.data);

  if (!created) {
    return null;
  }

  await persistImportedRating(userId, created.recipeId, structuredRecipe.importedRating);

  return created;
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

  const created: CreateRecipeResult[] = [];

  if (structuredRecipes && structuredRecipes.length > 0) {
    let index = 0;

    for (const structuredRecipe of structuredRecipes) {
      index++;
      await reportStep(job, `creating-recipes:${index}/${structuredRecipes.length}`);
      const structuredResult = await createStructuredRecipe(structuredRecipe, userId, householdKey);

      if (!structuredResult) {
        continue;
      }

      created.push(structuredResult);
    }

    if (created.length === 0) {
      throw new Error("No valid recipes found in structured paste input.");
    }
  } else {
    const recipeId = recipeIds[0];

    if (!recipeId) {
      throw new Error("Missing recipe ID for paste import.");
    }

    await reportStep(job, "parsing-text");
    const parseResult = await parseFromPastedText(text, recipeId, forceAI);

    await reportStep(job, "saving");
    const textResult = await createRecipeWithRefs(recipeId, userId, parseResult.recipe);

    if (!textResult) {
      throw new Error("Failed to save imported recipe");
    }

    created.push(textResult);
  }

  await completeStep(job, { createdCount: created.length });
  await reportStep(job, "post-processing");

  for (const result of created) {
    const dashboardDto = await dashboardRecipe(result.recipeId);

    if (!dashboardDto) {
      continue;
    }

    log.info({ jobId: job.id, recipeId: result.recipeId }, "Pasted recipe imported successfully");

    // Import success is terminal here regardless of what enrichment does next.
    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: result.recipeId,
      toast: "imported",
    });

    await announceUsableRecipe(result, { userId, householdKey, householdUserIds });
  }

  return { recipeIds: created.map((result) => result.recipeId) };
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

const pasteImportWorker = defineLazyWorker(
  QUEUE_NAMES.PASTE_IMPORT,
  processPasteImportJob,
  handleJobFailed
);

export const startPasteImportWorker = pasteImportWorker.start;
export const stopPasteImportWorker = pasteImportWorker.stop;
