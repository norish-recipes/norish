/**
 * Ingredient Icons Worker
 *
 * One job for however many foods a mint's pass or Fill gaps left showing no
 * icon, one step per food, drawn one after another with the instance's image
 * provider and set as the food's own icon. A food that is gone or one a person
 * gave an icon meanwhile is passed over, and a food whose drawing broke is
 * recorded as failed on its own step, with the cause; neither ends the job.
 * The changes are announced together once every food is drawn. Its worker
 * wraps the processor so the image model each drawing asks reaches the job
 * monitor.
 */

import type { Job } from "bullmq";

import type { IngredientIconsJobData } from "@norish/queue/contracts/job-types";
import type { IconDrawOutcome } from "@norish/shared-server/ingredients/icon-rounds";
import { announcingTogether } from "@norish/shared-server/ingredients/changes";
import { drawNewIngredientIcon } from "@norish/shared-server/ingredients/icon-rounds";
import { createLogger } from "@norish/shared-server/logger";

import type { JobStepEvent } from "../job-steps";
import { createWorker } from "../create-worker";
import { describeError } from "../helpers";
import { recordCompletedSteps } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:ingredient-icons");

/** The base id of every food's step; the food's place in the job follows a colon. */
export const ICON_STEP = "drawing-icon";

/** What a food's completed step records: what came of it, or what broke. */
export type IconStepDetail = { ingredientId: string; name: string } & (
  IconDrawOutcome | { outcome: "failed"; error: string }
);

/** How many times a job writes its steps down: progress is rewritten whole on each write. */
const JOB_WRITES = 20;

/** Draw one food's icon; a failure is recorded on its step. */
async function draw(
  job: Job<IngredientIconsJobData>,
  food: IngredientIconsJobData["ingredients"][number]
): Promise<IconStepDetail> {
  const named = { ingredientId: food.id, name: food.name };

  try {
    return { ...named, ...(await drawNewIngredientIcon(food.id)) };
  } catch (error) {
    log.error(
      { err: error, jobId: job.id, ingredientId: food.id },
      "Drawing an Ingredient Icon failed"
    );

    return { ...named, outcome: "failed", error: describeError(error) };
  }
}

/** Exported so the job body can be exercised without a Valkey-backed worker. */
export async function processIngredientIconsJob(
  job: Job<IngredientIconsJobData>,
  _token?: string,
  signal?: AbortSignal
): Promise<void> {
  const { ingredients: foods } = job.data;
  const writeEvery = Math.max(1, Math.ceil(foods.length / JOB_WRITES));
  let unwritten: (JobStepEvent & { endedAt: number })[] = [];

  log.info({ jobId: job.id, count: foods.length }, "Drawing Ingredient Icons");

  // Every icon set is announced once, together, when the job is done.
  await announcingTogether(async () => {
    // ponytail: one drawing at a time, as image APIs rate-limit hard; draw a few at once if jobs feel slow.
    for (const [index, food] of foods.entries()) {
      // A cancelled job draws no further food.
      if (signal?.aborted) break;
      const startedAt = Date.now();
      const detail = await draw(job, food);

      unwritten.push({
        id: `${ICON_STEP}:${index + 1}/${foods.length}`,
        startedAt,
        endedAt: Date.now(),
        detail,
      });
      if (unwritten.length >= writeEvery || index + 1 === foods.length) {
        await recordCompletedSteps(job, unwritten);
        unwritten = [];
      }
    }
    if (unwritten.length > 0) await recordCompletedSteps(job, unwritten);
  });
  signal?.throwIfAborted();
}

export function startIngredientIconsWorker(): void {
  createWorker<IngredientIconsJobData>(QUEUE_NAMES.INGREDIENT_ICONS, processIngredientIconsJob);
}
