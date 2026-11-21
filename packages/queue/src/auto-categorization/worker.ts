/**
 * Auto-Categorization Worker
 *
 * One AI request over the owner's household Categories and a category
 * replacement. Gap-filling runs replace only while the stored list is still
 * empty, so data supplied while AI was running wins.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { listCategoryNamesForUsers } from "@norish/db/repositories/categories";
import { getHouseholdMemberIds } from "@norish/db/repositories/households";
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

/** One auto-categorization run, picking from the recipe owner's household list (ADR-0040). */
export async function processAutoCategorizationJob(
  job: Job<RecipeEnrichmentJobData>
): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    const owners = recipe.userId ? await getHouseholdMemberIds(recipe.userId) : [];
    const categories = await categorizeRecipe(
      toRecipeSummary(recipe),
      await listCategoryNamesForUsers(owners)
    );

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
  });
}

export function startAutoCategorizationWorker(): void {
  createWorker<RecipeEnrichmentJobData>(
    QUEUE_NAMES.AUTO_CATEGORIZATION,
    processAutoCategorizationJob,
    { onFailed: handleEnrichmentJobFailure }
  );
}
