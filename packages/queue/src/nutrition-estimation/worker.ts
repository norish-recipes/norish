/**
 * Nutrition Estimation Worker
 *
 * One AI request and an atomic replacement of the whole Nutrition Information
 * group. Automatic runs replace only while the group is still incomplete; a
 * group that already has all four values is authoritative.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { replaceRecipeNutrition } from "@norish/db/repositories/recipe-enrichment";
import { estimateNutritionFromIngredients } from "@norish/shared-server/ai/enrichment/nutrition-estimator";
import { createLogger } from "@norish/shared-server/logger";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { handleEnrichmentJobFailure, runEnrichmentJob } from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:nutrition-estimation");

const nutritionEstimationWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.NUTRITION_ESTIMATION,
  (job) =>
    runEnrichmentJob(job, async (recipe) => {
      const estimate = await estimateNutritionFromIngredients(
        recipe.name,
        recipe.servings ?? 1,
        recipe.recipeIngredients.map((ingredient) => ({
          ingredientName: ingredient.ingredientName,
          amount: ingredient.amount,
          unit: ingredient.unit,
        }))
      );

      // The estimate is complete by contract: the schema requires all four
      // values as non-negative numbers, so the runtime has already rejected —
      // and will retry — a model answer with anything missing.
      await reportStep(job, "saving");

      const applied = await replaceRecipeNutrition(recipe.id, estimate, job.data.origin);

      log.info(
        { recipeId: recipe.id, applied, origin: job.data.origin },
        applied ? "Nutrition estimate saved" : "Nutrition estimate deferred to supplied data"
      );

      return applied;
    }),
  handleEnrichmentJobFailure
);

export const startNutritionEstimationWorker = nutritionEstimationWorker.start;
export const stopNutritionEstimationWorker = nutritionEstimationWorker.stop;
