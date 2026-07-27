/**
 * Auto-Categorization Worker
 *
 * One AI request and a category replacement. Automatic runs replace only while
 * the stored list is still empty, so data supplied while AI was running wins.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { replaceRecipeCategories } from "@norish/db/repositories/recipe-enrichment";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { createLogger } from "@norish/shared-server/logger";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:auto-categorization");

const autoCategorizationWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.AUTO_CATEGORIZATION,
  (job) =>
    runEnrichmentJob(job, async (recipe) => {
      const categorizeRecipe = requireQueueApiHandler("categorizeRecipe");
      const result = await categorizeRecipe(toRecipeSummary(recipe));

      if (!result.success) {
        throw new Error(result.error);
      }

      if (result.data.length === 0) {
        // Replacement with nothing would erase stored categories, so an empty
        // result is a failure the job retries rather than a write.
        throw new Error("AI returned no categories to replace the stored list with");
      }

      await reportStep(job, "saving");

      const applied = await replaceRecipeCategories(recipe.id, result.data, job.data.origin);

      log.info(
        { recipeId: recipe.id, categories: result.data, applied, origin: job.data.origin },
        applied ? "Auto-categorization saved" : "Auto-categorization deferred to supplied data"
      );

      return applied;
    }),
  handleEnrichmentJobFailure
);

export const startAutoCategorizationWorker = autoCategorizationWorker.start;
export const stopAutoCategorizationWorker = autoCategorizationWorker.stop;
