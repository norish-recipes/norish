import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";
import {
  findCatalogueIngredientNames,
  listAskableIngredientIds,
  listListedIngredientIds,
} from "@norish/db/repositories/ingredient-catalogue";
import {
  getAutomaticIngredientsConfig,
  isAIEnabled,
} from "@norish/shared-server/config/server-config-loader";

import { hasQueuedJobNamed } from "../helpers";
import { queueIconAndFills } from "../ingredient-fill/producer";
import { getQueues } from "../registry";

/**
 * What a mint for someone's action queues: AI's pass where Clean up new ingredients is on, which
 * draws and fills after it, else the missing icon and gaps straight away.
 */
export async function queueAfterMint(ingredientIds: readonly string[]): Promise<void> {
  if ((await getAutomaticIngredientsConfig()).cleanUp) await addIngredientReviewJob(ingredientIds);
  else await queueIconAndFills(ingredientIds);
}

/** Queue the AI pass over these foods. Nothing is queued while AI is off, or for a food gone since. */
export async function addIngredientReviewJob(ingredientIds: readonly string[]): Promise<void> {
  await addReviewJob(ingredientIds);
}

/** The job name of an administrator's Clean up catalogue run, told apart from a mint's pass. */
export const CATALOGUE_CLEAN_UP = "clean-up";

/** Which foods a Clean up catalogue run asks about (CONTEXT.md, Catalogue Cleanup). */
export type CleanUpScope = "recipe-foods" | "whole-catalogue";

/** The foods a Clean up over the scope asks about. */
export async function listCleanUpFoods(scope: CleanUpScope): Promise<string[]> {
  return scope === "whole-catalogue"
    ? await listListedIngredientIds()
    : await listAskableIngredientIds();
}

/** Whether a Clean up catalogue run is waiting or running: one runs at a time. */
export async function isCatalogueCleanUpRunning(): Promise<boolean> {
  return await hasQueuedJobNamed(getQueues().ingredientReview, CATALOGUE_CLEAN_UP);
}

/** Queue a Clean up catalogue run over the scope's foods; answers how many it asks about. */
export async function addCatalogueCleanUpJob(scope: CleanUpScope): Promise<number> {
  return await addReviewJob(
    await listCleanUpFoods(scope),
    CATALOGUE_CLEAN_UP,
    scope === "whole-catalogue" ? { wholeCatalogue: true } : {}
  );
}

async function addReviewJob(
  ingredientIds: readonly string[],
  jobName = "review",
  asked: Pick<IngredientReviewJobData, "wholeCatalogue"> = {}
): Promise<number> {
  if (ingredientIds.length === 0 || !(await isAIEnabled())) return 0;
  const names = await findCatalogueIngredientNames(ingredientIds);
  const ingredients = [...names].map(([id, name]) => ({ id, name }));

  if (ingredients.length > 0) {
    await getQueues().ingredientReview.add(jobName, { ingredients, ...asked });
  }

  return ingredients.length;
}
