/**
 * Auto-Tagging Worker
 *
 * One AI request, validated output, and an append that can never remove an
 * existing tag. Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { appendRecipeTags } from "@norish/db/repositories/tags";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { createLogger } from "@norish/shared-server/logger";
import { normalizeEnrichmentTagNames } from "@norish/shared/lib/recipe-enrichment";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:auto-tagging");

export async function startAutoTaggingWorker(): Promise<void> {
  await createLazyWorker<RecipeEnrichmentJobData>(
    QUEUE_NAMES.AUTO_TAGGING,
    (job) =>
      runEnrichmentJob(job, async (recipe) => {
        const generateTagsForRecipe = requireQueueApiHandler("generateTagsForRecipe");
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
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.AUTO_TAGGING],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.AUTO_TAGGING],
    },
    handleEnrichmentJobFailure
  );
}

export async function stopAutoTaggingWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.AUTO_TAGGING);
}
