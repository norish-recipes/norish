/**
 * Auto-Categorization Worker
 *
 * One AI request and a category replacement. Gap-filling runs replace only
 * while the stored list is still empty, so data supplied while AI was running
 * wins.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { replaceRecipeCategories } from "@norish/db/repositories/recipe-enrichment";
import { categorizeRecipe } from "@norish/shared-server/ai/enrichment/auto-categorizer";
import { createLogger } from "@norish/shared-server/logger";
import { enrichmentWriteMode } from "@norish/shared/lib/recipe-enrichment";

import { createWorker } from "../create-worker";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:auto-categorization");

export function startAutoCategorizationWorker(): void {
  createWorker<RecipeEnrichmentJobData>(
    QUEUE_NAMES.AUTO_CATEGORIZATION,
    (job) =>
      runEnrichmentJob(job, async (recipe) => {
        const categories = await categorizeRecipe(toRecipeSummary(recipe));

        if (categories.length === 0) {
          // Replacement with nothing would erase stored categories, so an empty
          // result is a failure the job retries rather than a write.
          throw new Error("AI returned no categories to replace the stored list with");
        }

        await reportStep(job, "saving");

        const mode = enrichmentWriteMode("auto-categorization", job.data);
        const applied = await replaceRecipeCategories(recipe.id, categories, mode);

        log.info(
          { recipeId: recipe.id, categories, applied, origin: job.data.origin, mode },
          applied ? "Auto-categorization saved" : "Auto-categorization deferred to supplied data"
        );

        return applied;
      }),
    { onFailed: handleEnrichmentJobFailure }
  );
}
