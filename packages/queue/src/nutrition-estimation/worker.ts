/**
 * Nutrition Estimation Worker
 *
 * One AI request and an atomic replacement of the whole Nutrition Information
 * group. Automatic runs replace only while the whole group is still absent.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import {
  replaceRecipeNutrition,
  replaceRecipeNutritionIfAbsent,
} from "@norish/db/repositories/recipe-enrichment";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { createLogger } from "@norish/shared-server/logger";
import { hasSubstantiveNutrition } from "@norish/shared/lib/recipe-enrichment";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { handleEnrichmentJobFailure, runEnrichmentJob } from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:nutrition-estimation");

export async function startNutritionEstimationWorker(): Promise<void> {
  await createLazyWorker<RecipeEnrichmentJobData>(
    QUEUE_NAMES.NUTRITION_ESTIMATION,
    (job) =>
      runEnrichmentJob(job, async (recipe) => {
        const estimateNutritionFromIngredients = requireQueueApiHandler(
          "estimateNutritionFromIngredients"
        );

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

        const applied =
          job.data.origin === "manual"
            ? await replaceRecipeNutrition(recipe.id, result.data)
            : await replaceRecipeNutritionIfAbsent(recipe.id, result.data);

        log.info(
          { recipeId: recipe.id, applied, origin: job.data.origin },
          applied ? "Nutrition estimate saved" : "Nutrition estimate deferred to supplied data"
        );

        return applied;
      }),
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.NUTRITION_ESTIMATION],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.NUTRITION_ESTIMATION],
    },
    handleEnrichmentJobFailure
  );
}

export async function stopNutritionEstimationWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.NUTRITION_ESTIMATION);
}
