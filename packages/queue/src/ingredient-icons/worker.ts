/**
 * Ingredient Icons Worker
 *
 * A Draw icons round (`@norish/shared-server/ingredients/icon-rounds`): one
 * job for however many foods a person asked to be drawn, one step per food,
 * drawn one after another with the instance's image provider and set as the
 * food's own icon. The round's count follows over the socket as icons land,
 * and the changes are announced together once every food is drawn. A food
 * the asker may no longer edit, one that is gone or one a person gave an icon
 * meanwhile is passed over, and a food whose drawing broke is recorded as
 * failed on its own step, with the cause; neither ends the round. Uses the
 * lazy worker pattern, which wraps the processor so the image model each
 * drawing asks reaches the job monitor.
 */

import type { Job } from "bullmq";

import type { IngredientIconsJobData } from "@norish/queue/contracts/job-types";
import { announcingTogether } from "@norish/shared-server/ingredients/changes";
import { drawRoundIcon } from "@norish/shared-server/ingredients/icon-rounds";
import { createLogger } from "@norish/shared-server/logger";
import { ingredients } from "@norish/shared-server/realtime/ingredients";

import type { JobStepEvent } from "../job-steps";
import type { IconStepDetail } from "./progress";
import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { recordCompletedSteps } from "../job-steps";
import { ICON_STEP, summarizeIconRound } from "./progress";

const log = createLogger("worker:ingredient-icons");

/**
 * How many times a round writes its steps down and tells the pages how far it
 * has come: the job's progress is rewritten whole on each write, so a write
 * per food would store the square of the round's size.
 */
const ROUND_WRITES = 20;

/** An error's message, with the cause a wrapper hides. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : null;

  return cause ? `${error.message}: ${cause}` : error.message;
}

/** Draw one food's icon. Nothing here ends the round: a failure is recorded on the food's step. */
async function draw(
  job: Job<IngredientIconsJobData>,
  ingredientId: string
): Promise<IconStepDetail> {
  try {
    return { ingredientId, ...(await drawRoundIcon(job.data.actor, ingredientId)) };
  } catch (error) {
    log.error({ err: error, jobId: job.id, ingredientId }, "Drawing an Ingredient Icon failed");

    return { ingredientId, outcome: "failed", error: describe(error) };
  }
}

/** Tell every open page how far the round is. Best-effort: the icons themselves have landed. */
async function announceRound(job: Job<IngredientIconsJobData>, finished: boolean): Promise<void> {
  try {
    await ingredients.publish("icons", summarizeIconRound(job, finished), undefined);
  } catch (error) {
    log.warn({ err: error, jobId: job.id }, "Could not announce the round's progress");
  }
}

/** Exported so the job body can be exercised without a Redis-backed worker. */
export async function processIngredientIconsJob(job: Job<IngredientIconsJobData>): Promise<void> {
  const { ingredients: foods } = job.data;
  const writeEvery = Math.max(1, Math.ceil(foods.length / ROUND_WRITES));
  let unwritten: (JobStepEvent & { endedAt: number })[] = [];

  log.info({ jobId: job.id, count: foods.length }, "Drawing Ingredient Icons");

  // Every icon set is announced once, together, when the round is done.
  await announcingTogether(async () => {
    // ponytail: one drawing at a time, as image APIs rate-limit hard; draw a few at once if rounds feel slow.
    for (const [index, food] of foods.entries()) {
      const startedAt = Date.now();
      const { ingredientId, ...outcome } = await draw(job, food.id);

      unwritten.push({
        id: `${ICON_STEP}:${index + 1}/${foods.length}`,
        startedAt,
        endedAt: Date.now(),
        detail: { ingredientId, name: food.name, ...outcome },
      });
      if (unwritten.length < writeEvery && index + 1 < foods.length) continue;

      await recordCompletedSteps(job, unwritten);
      unwritten = [];
      if (index + 1 < foods.length) await announceRound(job, false);
    }
  });
  await announceRound(job, true);
}

/** A round that gave up ends on every open page too, at the count it reached. */
export async function handleIngredientIconsFailure(
  job: Job<IngredientIconsJobData> | undefined,
  error: Error
): Promise<void> {
  log.error({ jobId: job?.id, err: error }, "A Draw icons round failed");
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  await announceRound(job, true);
}

const ingredientIconsWorker = defineLazyWorker<IngredientIconsJobData>(
  QUEUE_NAMES.INGREDIENT_ICONS,
  processIngredientIconsJob,
  handleIngredientIconsFailure
);

export const startIngredientIconsWorker = ingredientIconsWorker.start;
export const stopIngredientIconsWorker = ingredientIconsWorker.stop;
