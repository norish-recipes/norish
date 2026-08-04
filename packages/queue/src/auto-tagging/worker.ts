/**
 * Auto-Tagging Worker
 *
 * One AI request, validated output, and an append that can never remove an
 * existing tag. Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { appendRecipeTags } from "@norish/db/repositories/tags";
import { generateTagsForRecipe } from "@norish/shared-server/ai/enrichment/auto-tagger";
import { createLogger } from "@norish/shared-server/logger";
import { normalizeEnrichmentTagNames } from "@norish/shared/lib/recipe-enrichment";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:auto-tagging");

const autoTaggingWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.AUTO_TAGGING,
  (job) =>
    runEnrichmentJob(job, async (recipe) => {
      const result = await generateTagsForRecipe(toRecipeSummary(recipe));

      if (!result.success) {
        throw new Error(result.error);
      }

      const tags = normalizeEnrichmentTagNames(result.data);

      if (tags.length === 0) {
        // Nothing to append is a legitimate outcome, not a failure: appending
        // adds findings, and an empty finding set removes nothing.
        log.info({ recipeId: recipe.id }, "AI returned no tags");

        return false;
      }

      await reportStep(job, "saving");
      const { added } = await appendRecipeTags(recipe.id, tags);

      log.info({ recipeId: recipe.id, added }, "Auto-tagging saved");

      return added.length > 0;
    }),
  handleEnrichmentJobFailure
);

export const startAutoTaggingWorker = autoTaggingWorker.start;
export const stopAutoTaggingWorker = autoTaggingWorker.stop;
