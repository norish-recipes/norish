/**
 * Paste Import Worker
 *
 * Processes pasted recipe text or pasted JSON-LD.
 */

import type { PasteImportJobData } from "@/types";

import { Worker, type Job } from "bullmq";

import { redisConnection, QUEUE_NAMES } from "../config";

import { createLogger } from "@/server/logger";
import { emitByPolicy, type PolicyEmitContext } from "@/server/trpc/helpers";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getRecipePermissionPolicy, getAIConfig, isAIEnabled } from "@/config/server-config-loader";
import { createRecipeWithRefs, dashboardRecipe, getAllergiesForUsers } from "@/server/db";
import { extractRecipeNodesFromJsonLd } from "@/lib/parser/jsonld";
import { normalizeRecipeFromJson } from "@/lib/parser/normalize";
import { extractRecipeWithAI } from "@/server/ai/recipe-parser";
import { MAX_RECIPE_PASTE_CHARS } from "@/types/uploads";

const log = createLogger("worker:paste-import");

let worker: Worker<PasteImportJobData> | null = null;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return true;
  return t.includes("@context") || t.includes("@graph") || t.includes('"@type"');
}

function hasStepsAndIngredients(parsed: any): boolean {
  return (
    !!parsed &&
    Array.isArray(parsed.recipeIngredients) &&
    parsed.recipeIngredients.length > 0 &&
    Array.isArray(parsed.steps) &&
    parsed.steps.length > 0
  );
}

async function parseFromPastedText(
  text: string,
  allergies?: string[],
  forceAI?: boolean
): Promise<any> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("No text provided");
  if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
    throw new Error(`Paste is too large (max ${MAX_RECIPE_PASTE_CHARS} characters)`);
  }

  const aiEnabled = await isAIEnabled();
  if (forceAI) {
    if (!aiEnabled) {
      throw new Error("AI-only import requested but AI is not enabled.");
    }

    const html = `<html><body><main><h1>Pasted recipe</h1><p>${escapeHtml(trimmed)}</p></main></body></html>`;
    const ai = await extractRecipeWithAI(html, undefined, allergies);

    if (ai && hasStepsAndIngredients(ai)) {
      return ai;
    }

    throw new Error("Could not parse pasted recipe.");
  }

  if (looksLikeJson(trimmed)) {
    const html = `<html><head></head><body><script type="application/ld+json">${trimmed}</script></body></html>`;
    const nodes = extractRecipeNodesFromJsonLd(html);

    if (nodes.length > 0) {
      const normalized = await normalizeRecipeFromJson(nodes[0]);
      if (normalized) {
        normalized.url = null;
        if (hasStepsAndIngredients(normalized)) {
          return normalized;
        }
      }
    }
  }

  if (!aiEnabled) {
    throw new Error("Could not parse pasted recipe. Try pasting JSON-LD, or enable AI import.");
  }

  const html = `<html><body><main><h1>Pasted recipe</h1><p>${escapeHtml(trimmed)}</p></main></body></html>`;
  const ai = await extractRecipeWithAI(html, undefined, allergies);

  if (ai && hasStepsAndIngredients(ai)) {
    return ai;
  }

  throw new Error("Could not parse pasted recipe.");
}

async function processPasteImportJob(job: Job<PasteImportJobData>): Promise<void> {
  const { recipeId, userId, householdKey, householdUserIds, text, forceAI } = job.data;

  log.info({ jobId: job.id, recipeId, attempt: job.attemptsMade + 1 }, "Processing paste import job");

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", {
    recipeId,
    url: "[pasted]",
  });

  const aiConfig = await getAIConfig();
  let allergyNames: string[] | undefined;

  if (aiConfig?.autoTagAllergies) {
    const householdAllergies = await getAllergiesForUsers(householdUserIds ?? [userId]);
    allergyNames = [...new Set(householdAllergies.map((a) => a.tagName))];
    log.debug({ allergyCount: allergyNames.length }, "Fetched household allergies for paste import");
  }

  const parsedRecipe = await parseFromPastedText(text, allergyNames, forceAI);

  const createdId = await createRecipeWithRefs(recipeId, userId, parsedRecipe);
  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  const dashboardDto = await dashboardRecipe(createdId);
  if (dashboardDto) {
    log.info({ jobId: job.id, recipeId: createdId }, "Pasted recipe imported successfully");

    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
    });
  }
}

async function handleJobFailed(job: Job<PasteImportJobData> | undefined, error: Error): Promise<void> {
  if (!job) return;

  const { recipeId, userId, householdKey } = job.data;
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
    "Paste import job failed"
  );

  if (isFinalFailure) {
    const policy = await getRecipePermissionPolicy();
    const ctx: PolicyEmitContext = { userId, householdKey };

    emitByPolicy(recipeEmitter, policy.view, ctx, "failed", {
      reason: error.message || "Failed to import recipe",
      recipeId,
      url: "[pasted]",
    });
  }
}

export function startPasteImportWorker(): void {
  if (worker) {
    log.warn("Paste import worker already running");
    return;
  }

  worker = new Worker<PasteImportJobData>(QUEUE_NAMES.PASTE_IMPORT, processPasteImportJob, {
    connection: redisConnection,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Paste import job completed");
  });

  worker.on("failed", (job, error) => {
    handleJobFailed(job, error);
  });

  worker.on("error", (error) => {
    log.error({ error }, "Paste import worker error");
  });

  log.info("Paste import worker started");
}

export async function stopPasteImportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("Paste import worker stopped");
  }
}
