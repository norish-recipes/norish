/**
 * Nutrition Estimation Worker
 *
 * One AI request and an atomic replacement of the whole Nutrition Information
 * group. Automatic runs replace only while the whole group is still absent.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { replaceRecipeNutrition } from "@norish/db/repositories/recipe-enrichment";
import { estimateNutritionFromIngredients } from "@norish/shared-server/ai/enrichment/nutrition-estimator";
import { createLogger } from "@norish/shared-server/logger";
import { hasSubstantiveNutrition } from "@norish/shared/lib/recipe-enrichment";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { handleEnrichmentJobFailure, runEnrichmentJob } from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:nutrition-estimation");

const nutritionEstimationWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.NUTRITION_ESTIMATION,
  (job) =>
    runEnrichmentJob(job, async (recipe) => {
      const result = await estimateNutritionFromIngredients(
        recipe.name,
        recipe.servings ?? 1,
        recipe.recipeIngredients.map((ingredient) => ({
          ingredientName: ingredient.ingredientName,
          amount: ingredient.amount,
          unit: ingredient.unit,
        }))
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      if (!hasSubstantiveNutrition(result.data)) {
        // Replacement clears whatever it does not set, so an entirely blank
        // estimate must fail rather than wipe the stored group.
        throw new Error("AI returned no substantive Nutrition Information");
      }

      await reportStep(job, "saving");

      const applied = await replaceRecipeNutrition(recipe.id, result.data, job.data.origin);

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
