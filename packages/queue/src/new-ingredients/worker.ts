/**
 * New Ingredients Worker
 *
 * What the administrator turned on for foods just minted by someone's action
 * (Automatic for new ingredients): each food is given its Plain Name, then
 * drawn an icon where it would show none, so the icon is drawn from the name
 * it ends up with. Read the settings as the job runs, so one switched off
 * meanwhile stops. A food whose question or drawing fails is logged and left
 * as it was: the Clean names and Draw icons rounds still reach it. Uses the
 * lazy worker pattern, which wraps the processor so the models each food
 * asks reach the job monitor.
 */

import type { Job } from "bullmq";

import type { NewIngredientsJobData } from "@norish/queue/contracts/job-types";
import { getAutomaticIngredientsConfig } from "@norish/shared-server/config/server-config-loader";
import { drawNewIngredientIcon } from "@norish/shared-server/ingredients/icon-rounds";
import { giveNewIngredientItsPlainName } from "@norish/shared-server/ingredients/plain-names";
import { createLogger } from "@norish/shared-server/logger";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { reportStep } from "../job-steps";

const log = createLogger("worker:new-ingredients");

/** Exported so the job body can be exercised without a Redis-backed worker. */
export async function processNewIngredientsJob(job: Job<NewIngredientsJobData>): Promise<void> {
  const { plainName, icon } = await getAutomaticIngredientsConfig();

  for (const ingredientId of job.data.ingredientIds) {
    if (plainName) {
      await reportStep(job, "naming", { ingredientId });
      try {
        await giveNewIngredientItsPlainName(ingredientId);
      } catch (error) {
        log.warn({ err: error, jobId: job.id, ingredientId }, "Naming a new Ingredient failed");
      }
    }
    if (icon) {
      await reportStep(job, "drawing-icon", { ingredientId });
      try {
        await drawNewIngredientIcon(ingredientId);
      } catch (error) {
        log.warn({ err: error, jobId: job.id, ingredientId }, "Drawing a new Ingredient failed");
      }
    }
  }
}

const newIngredientsWorker = defineLazyWorker<NewIngredientsJobData>(
  QUEUE_NAMES.NEW_INGREDIENTS,
  processNewIngredientsJob
);

export const startNewIngredientsWorker = newIngredientsWorker.start;
export const stopNewIngredientsWorker = newIngredientsWorker.stop;
