/**
 * Recipe Provenance Worker
 *
 * One AI request and one atomic write of the provenance group. A replacing run
 * replaces the whole group; a gap-filling run fills its gaps, keeping every
 * supplied slot (ADR-0018) — which is why the stored slots ride along into
 * inference as settled facts, and why a replacing run withholds them: a refresh
 * that is told the stored country is settled can only hand it back.
 *
 * The worker holds no database handle and composes no queries: it calls one
 * repository operation, which is where every provenance write lives.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { replaceRecipeProvenance } from "@norish/db/repositories/recipe-enrichment";
import { inferRecipeProvenance } from "@norish/shared-server/ai/enrichment/provenance-inferrer";
import { createLogger } from "@norish/shared-server/logger";
import {
  enrichmentWriteMode,
  hasSubstantiveProvenance,
} from "@norish/shared/lib/recipe-enrichment";

import { createWorker } from "../create-worker";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:recipe-provenance");

/** Exported so the job body can be exercised without a Valkey-backed worker. */
export async function processRecipeProvenanceJob(job: Job<RecipeEnrichmentJobData>): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    const mode = enrichmentWriteMode("recipe-provenance", job.data);
    const claim = await inferRecipeProvenance({
      ...toRecipeSummary(recipe),
      // The supplied slots, so the model writes the missing fields around
      // them instead of working the whole claim out against them. A replacing
      // run withholds them on purpose: the write is about to discard the
      // stored group, so handing it back as settled fact would make the
      // refresh re-derive the very answer it was asked to reconsider.
      supplied:
        mode === "replace"
          ? undefined
          : {
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

    const applied = await replaceRecipeProvenance(recipe.id, claim, mode);

    log.info(
      {
        recipeId: recipe.id,
        originCountry: claim.originCountry,
        cuisineCount: claim.cuisineIds.length,
        applied,
        origin: job.data.origin,
        mode,
      },
      applied ? "Recipe Provenance saved" : "Recipe Provenance deferred to supplied data"
    );

    return applied;
  });
}

export function startRecipeProvenanceWorker(): void {
  createWorker<RecipeEnrichmentJobData>(QUEUE_NAMES.RECIPE_PROVENANCE, processRecipeProvenanceJob, {
    onFailed: handleEnrichmentJobFailure,
  });
}
