/**
 * Recipe Provenance Worker
 *
 * One AI request and one atomic write of the provenance group. A manual run
 * replaces the whole group; an automatic run fills its gaps, keeping every
 * supplied slot (ADR-0018) — which is why the stored slots ride along into
 * inference as settled facts. Uses lazy worker pattern - starts on-demand and
 * pauses when idle.
 *
 * The worker holds no database handle and composes no queries: it calls one
 * repository operation, which is where every provenance write lives.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { replaceRecipeProvenance } from "@norish/db/repositories/recipe-enrichment";
import { inferRecipeProvenance } from "@norish/shared-server/ai/enrichment/provenance-inferrer";
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
    const claim = await inferRecipeProvenance({
      ...toRecipeSummary(recipe),
      // The supplied slots, so the model writes the missing fields around
      // them instead of working the whole claim out against them.
      supplied: {
        originCountry: recipe.originCountry,
        originRegion: recipe.originRegion,
        provenanceNote: recipe.provenanceNote,
        cuisineNames: recipe.cuisines.map((cuisine) => cuisine.name),
      },
    });

    if (claim.cuisineIds.length === 0 && !hasSubstantiveProvenance(claim)) {
      // A write clears or skips what a claim does not bring, so an entirely
      // empty claim must fail rather than accomplish nothing. A claim that is
      // only Cuisines is still substantive.
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
