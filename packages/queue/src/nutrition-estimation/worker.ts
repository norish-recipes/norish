/**
 * Nutrition Estimation Worker
 *
 * A recipe that supplies Nutrition Information of its own is estimated as
 * a whole, as before: one AI request and an atomic replacement of the group,
 * where gap-filling runs replace only while the group is still incomplete.
 *
 * A recipe that supplies none has its nutrition worked out from its lines
 * (ADR-0039), and the language model fills only the gap: it is given the
 * lines Ingredient Nutrition counts, with their numbers, and estimates the
 * lines left out. Its share is stored apart from the recipe's own group,
 * with the lines it covered, and added to a reader's worked-out total while
 * those are still the lines left out. A recipe whose every line counts asks
 * the model nothing. The lines are counted from the datasets' numbers, with
 * no household's correction, which is what most readers see.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import {
  clearRecipeNutritionEstimate,
  replaceRecipeNutrition,
  saveRecipeNutritionEstimate,
} from "@norish/db/repositories/recipe-enrichment";
import { estimateNutritionFromIngredients } from "@norish/shared-server/ai/enrichment/nutrition-estimator";
import { NO_HOUSEHOLD } from "@norish/shared-server/ingredients/nutrition/ingredient-nutrition";
import { workOutRecipeNutrition } from "@norish/shared-server/ingredients/nutrition/recipe-nutrition";
import { createLogger } from "@norish/shared-server/logger";
import { enrichmentWriteMode } from "@norish/shared/lib/recipe-enrichment";
import { suppliesNutrition } from "@norish/shared/lib/recipe-nutrition";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { handleEnrichmentJobFailure, runEnrichmentJob } from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:nutrition-estimation");

export async function processNutritionEstimationJob(
  job: Job<RecipeEnrichmentJobData>
): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    if (suppliesNutrition(recipe)) {
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

      const mode = enrichmentWriteMode("nutrition-estimation", job.data);
      const applied = await replaceRecipeNutrition(recipe.id, estimate, mode);

      log.info(
        { recipeId: recipe.id, applied, origin: job.data.origin, mode },
        applied ? "Nutrition estimate saved" : "Nutrition estimate deferred to supplied data"
      );

      return applied;
    }

    const worked = await workOutRecipeNutrition(recipe, NO_HOUSEHOLD);

    if (!worked || worked.uncounted.length === 0) {
      log.info({ recipeId: recipe.id }, "Every line counts; no estimate asked for");

      return await clearRecipeNutritionEstimate(recipe.id);
    }

    const lineById = new Map(recipe.recipeIngredients.map((line) => [line.id, line]));
    const estimate = await estimateNutritionFromIngredients(
      recipe.name,
      recipe.servings ?? 1,
      worked.uncounted.map((named) => ({
        ingredientName: named.name,
        amount: lineById.get(named.lineId)?.amount ?? null,
        unit: lineById.get(named.lineId)?.unit ?? null,
      })),
      worked.counted.map((line) => {
        const counted = lineById.get(line.lineId);
        const text = [counted?.amount, counted?.unit, line.name].filter((part) => part != null);

        return { ...line, text: text.join(" ") };
      })
    );

    await reportStep(job, "saving");

    const saved = await saveRecipeNutritionEstimate(recipe.id, {
      ...estimate,
      lines: worked.uncounted.map((named) => named.key),
    });

    log.info(
      { recipeId: recipe.id, saved, uncounted: worked.uncounted.length, origin: job.data.origin },
      "Nutrition estimate of the lines left out saved"
    );

    return saved;
  });
}

const nutritionEstimationWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.NUTRITION_ESTIMATION,
  processNutritionEstimationJob,
  handleEnrichmentJobFailure
);

export const startNutritionEstimationWorker = nutritionEstimationWorker.start;
export const stopNutritionEstimationWorker = nutritionEstimationWorker.stop;
