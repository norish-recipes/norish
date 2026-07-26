/**
 * Allergy Detection Worker
 *
 * One AI request against the household's configured allergies, then an append
 * that can never remove existing safety information.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { getAllergiesForUsers, getHouseholdMemberIds } from "@norish/db";
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

const log = createLogger("worker:allergy-detection");

export async function startAllergyDetectionWorker(): Promise<void> {
  await createLazyWorker<RecipeEnrichmentJobData>(
    QUEUE_NAMES.ALLERGY_DETECTION,
    (job) =>
      runEnrichmentJob(job, async (recipe) => {
        const detectAllergiesInRecipe = requireQueueApiHandler("detectAllergiesInRecipe");
        const memberIds =
          job.data.householdUserIds ?? (await getHouseholdMemberIds(job.data.userId));
        const allergies = await getAllergiesForUsers(memberIds);
        const allergiesToDetect = Array.from(new Set(allergies.map((allergy) => allergy.tagName)));

        if (allergiesToDetect.length === 0) {
          // The household stopped configuring allergies between enrollment and
          // execution: there is nothing to look for, and that is not an error.
          log.info({ recipeId: recipe.id }, "No configured household allergies to detect");

          return false;
        }

        const result = await detectAllergiesInRecipe(toRecipeSummary(recipe), allergiesToDetect);

        if (!result.success) {
          throw new Error(result.error);
        }

        const detected = normalizeEnrichmentTagNames(result.data);

        if (detected.length === 0) {
          log.info({ recipeId: recipe.id }, "AI detected no allergens");

          return false;
        }

        await reportStep(job, "saving");
        const { added } = await appendRecipeTags(recipe.id, detected);

        log.info({ recipeId: recipe.id, added }, "Allergy detection saved");

        return added.length > 0;
      }),
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.ALLERGY_DETECTION],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.ALLERGY_DETECTION],
    },
    handleEnrichmentJobFailure
  );
}

export async function stopAllergyDetectionWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.ALLERGY_DETECTION);
}
