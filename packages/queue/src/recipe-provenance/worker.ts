/**
 * Recipe Provenance Worker
 *
 * One AI request and an atomic replacement of the whole provenance group.
 * Automatic runs replace only while the whole group is still absent.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 *
 * The worker holds no database handle and composes no queries: it calls one
 * repository operation, which is where every provenance write lives.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { replaceRecipeProvenance } from "@norish/db/repositories/recipe-enrichment";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { createLogger } from "@norish/shared-server/logger";
import { hasSubstantiveProvenance } from "@norish/shared/lib/recipe-enrichment";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:recipe-provenance");

/** Exported so the job body can be exercised without a Redis-backed worker. */
export async function processRecipeProvenanceJob(job: Job<RecipeEnrichmentJobData>): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    const inferRecipeProvenance = requireQueueApiHandler("inferRecipeProvenance");
    const result = await inferRecipeProvenance(toRecipeSummary(recipe));

    if (!result.success) {
      throw new Error(result.error);
    }

    const claim = result.data;

    if (claim.cuisineIds.length === 0 && !hasSubstantiveProvenance(claim)) {
      // Replacement clears whatever it does not set, so an entirely empty claim
      // must fail rather than wipe the stored group. A claim that is only
      // Cuisines is still substantive: the group is atomic in both directions.
      throw new Error("AI returned no substantive Recipe Provenance");
    }

    await reportStep(job, "saving");

    const applied = await replaceRecipeProvenance(recipe.id, claim, job.data.origin);

    log.info(
      {
        recipeId: recipe.id,
        originCountry: claim.originCountry,
        cuisineCount: claim.cuisineIds.length,
        applied,
        origin: job.data.origin,
      },
      applied ? "Recipe Provenance saved" : "Recipe Provenance deferred to supplied data"
    );

    return applied;
  });
}

const recipeProvenanceWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.RECIPE_PROVENANCE,
  processRecipeProvenanceJob,
  handleEnrichmentJobFailure
);

export const startRecipeProvenanceWorker = recipeProvenanceWorker.start;
export const stopRecipeProvenanceWorker = recipeProvenanceWorker.stop;
