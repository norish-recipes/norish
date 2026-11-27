/**
 * Allergy Detection Worker
 *
 * One AI request against the recipe's household's configured allergies, then an append
 * that can never remove existing safety information.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { getHouseholdAllergyNames } from "@norish/db";
import { appendRecipeTags } from "@norish/db/repositories/tags";
import { detectAllergiesInRecipe } from "@norish/shared-server/ai/enrichment/allergy-detector";
import { createLogger } from "@norish/shared-server/logger";
import { normalizeEnrichmentTagNames } from "@norish/shared/lib/recipe-enrichment";

import { createWorker } from "../create-worker";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:allergy-detection");

/** One allergy detection run, against the recipe's household's allergies as it runs. */
export async function processAllergyDetectionJob(job: Job<RecipeEnrichmentJobData>): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    const allergiesToDetect = await getHouseholdAllergyNames(recipe.householdId);

    if (allergiesToDetect.length === 0) {
      // The household stopped configuring allergies between enrollment and
      // execution: there is nothing to look for, and that is not an error.
      log.info({ recipeId: recipe.id }, "No configured household allergies to detect");

      return false;
    }

    const found = await detectAllergiesInRecipe(toRecipeSummary(recipe), allergiesToDetect);

    const detected = normalizeEnrichmentTagNames(found);

    if (detected.length === 0) {
      log.info({ recipeId: recipe.id }, "AI detected no allergens");

      return false;
    }

    await reportStep(job, "saving");
    const { added } = await appendRecipeTags(recipe.id, detected);

    log.info({ recipeId: recipe.id, added }, "Allergy detection saved");

    return added.length > 0;
  });
}

export function startAllergyDetectionWorker(): void {
  createWorker<RecipeEnrichmentJobData>(QUEUE_NAMES.ALLERGY_DETECTION, processAllergyDetectionJob, {
    onFailed: handleEnrichmentJobFailure,
  });
}
