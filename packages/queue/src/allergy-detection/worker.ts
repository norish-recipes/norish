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
import { detectAllergiesInRecipe } from "@norish/shared-server/ai/enrichment/allergy-detector";
import { createLogger } from "@norish/shared-server/logger";
import { normalizeEnrichmentTagNames } from "@norish/shared/lib/recipe-enrichment";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import {
  handleEnrichmentJobFailure,
  runEnrichmentJob,
  toRecipeSummary,
} from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:allergy-detection");

const allergyDetectionWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.ALLERGY_DETECTION,
  (job) =>
    runEnrichmentJob(job, async (recipe) => {
      const memberIds = job.data.householdUserIds ?? (await getHouseholdMemberIds(job.data.userId));
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
  handleEnrichmentJobFailure
);

export const startAllergyDetectionWorker = allergyDetectionWorker.start;
export const stopAllergyDetectionWorker = allergyDetectionWorker.stop;
