/**
 * Nutrition Estimation Producer - Application Logic
 *
 * Enqueue logic for nutrition estimation jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";

import type {
  AddNutritionEstimationJobResult,
  NutritionEstimationJobData,
} from "@norish/queue/contracts/job-types";
import { getRecipeFull } from "@norish/db";
import { getAIConfig } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";

import { isJobInQueue } from "../helpers";

const log = createLogger("queue:nutrition-estimation");

type AutoNutritionEstimationResult =
  | AddNutritionEstimationJobResult
  | {
      status: "skipped";
      reason: "disabled" | "recipe_not_found" | "existing_nutrition" | "no_ingredients";
    };

function hasNutrition(recipe: {
  calories: number | null;
  fat: string | null;
  carbs: string | null;
  protein: string | null;
}): boolean {
  return [recipe.calories, recipe.fat, recipe.carbs, recipe.protein].some(
    (value) => value !== null && value !== undefined && value !== ""
  );
}

function generateNutritionJobId(recipeId: string): string {
  return `nutrition_${recipeId}`;
}

/**
 * Add a nutrition estimation job to the queue.
 * Returns conflict status if a duplicate job already exists.
 */
export async function addNutritionEstimationJob(
  queue: Queue<NutritionEstimationJobData>,
  data: NutritionEstimationJobData
): Promise<AddNutritionEstimationJobResult> {
  const jobId = generateNutritionJobId(data.recipeId);

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add nutrition estimation job");

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate nutrition estimation job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("estimate", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Nutrition estimation job added to queue");

  return { status: "queued", job };
}

/**
 * Queue nutrition estimation after an import when the opt-in setting is enabled.
 * Existing nutrition is never overwritten.
 */
export async function addAutoNutritionEstimationJob(
  queue: Queue<NutritionEstimationJobData>,
  data: NutritionEstimationJobData
): Promise<AutoNutritionEstimationResult> {
  const aiConfig = await getAIConfig();

  if (!aiConfig?.enabled || !aiConfig.autoEstimateNutrition) {
    return { status: "skipped", reason: "disabled" };
  }

  const recipe = await getRecipeFull(data.recipeId);

  if (!recipe) {
    log.warn({ recipeId: data.recipeId }, "Imported recipe not found for nutrition estimation");

    return { status: "skipped", reason: "recipe_not_found" };
  }

  if (hasNutrition(recipe)) {
    log.debug({ recipeId: data.recipeId }, "Imported recipe already has nutrition data");

    return { status: "skipped", reason: "existing_nutrition" };
  }

  if (recipe.recipeIngredients.length === 0) {
    log.debug({ recipeId: data.recipeId }, "Imported recipe has no ingredients");

    return { status: "skipped", reason: "no_ingredients" };
  }

  return addNutritionEstimationJob(queue, data);
}
