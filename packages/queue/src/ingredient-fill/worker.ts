/**
 * AI filling foods' gaps (Fill Gaps): one job for however many foods, a step per food, each its
 * missing numbers, density and piece weight in one request; a food's failure ends only its step.
 */

import type { Job } from "bullmq";

import type { IngredientFillJobData } from "@norish/queue/contracts/job-types";
import type { FillOutcome } from "@norish/shared-server/ingredients/nutrition/fill-gaps";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  createModelUseLedger,
  recordModelUse,
  runWithModelUseLedger,
} from "@norish/shared-server/ai/runtime/model-use-ledger";
import { announcingTogether } from "@norish/shared-server/ingredients/changes";
import { fillNutritionGaps } from "@norish/shared-server/ingredients/nutrition/fill-gaps";
import { createLogger } from "@norish/shared-server/logger";

import type { JobStepEvent } from "../job-steps";
import { createWorker } from "../create-worker";
import { describeError } from "../helpers";
import { recordCompletedSteps } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:ingredient-fill");

/** The base id of every food's step; the food's place in the job follows a colon. */
export const FILL_STEP = "filling-gaps";

/** What a food's step records: what came of it, or what broke. */
export type FillStepDetail = { ingredientId: string; name: string } & (
  FillOutcome | { outcome: "failed"; error: string }
);

/** How many times a job writes its steps down: progress is rewritten whole on each write. */
const JOB_WRITES = 20;

/** Fill one food's gaps; an error is recorded on its step, and the job goes on. */
async function fill(
  job: Job<IngredientFillJobData>,
  food: IngredientFillJobData["ingredients"][number]
): Promise<FillStepDetail> {
  const named = { ingredientId: food.id, name: food.name };

  try {
    return { ...named, ...(await fillNutritionGaps(food.id, job.data.asked)) };
  } catch (error) {
    log.error({ err: error, jobId: job.id, ingredientId: food.id }, "Filling a food's gaps failed");

    return { ...named, outcome: "failed", error: describeError(error) };
  }
}

/** Exported so the job body can be exercised without a Valkey-backed worker. */
export async function processIngredientFillJob(
  job: Job<IngredientFillJobData>,
  _token?: string,
  signal?: AbortSignal
): Promise<void> {
  const { ingredients: foods, asked } = job.data;
  const writeEvery = Math.max(1, Math.ceil(foods.length / JOB_WRITES));
  let next = 0;
  let settled = 0;
  let unwritten: (JobStepEvent & { endedAt: number })[] = [];
  // Writes go out one after another, so the timeline keeps the order foods settled in.
  let recording = Promise.resolve();

  log.info({ jobId: job.id, count: foods.length, asked }, "Filling Ingredient gaps");

  const fillNext = async (): Promise<void> => {
    // A cancelled job asks about no further food.
    while (next < foods.length && !signal?.aborted) {
      const food = foods[next++]!;
      const startedAt = Date.now();
      // The food's own requests, so the monitor says what each food took; the attempt's too.
      const own = createModelUseLedger();
      const detail = await runWithModelUseLedger(own, () => fill(job, food));

      for (const use of own.uses) recordModelUse(use);
      settled += 1;
      unwritten.push({
        id: `${FILL_STEP}:${settled}/${foods.length}`,
        startedAt,
        endedAt: Date.now(),
        detail,
        models: own.uses,
      });
      if (unwritten.length < writeEvery && settled < foods.length) continue;

      const steps = unwritten;

      unwritten = [];
      recording = recording.then(() => recordCompletedSteps(job, steps));
      await recording;
    }
  };

  // As many foods at once as the AI pass asks; what the job filled is announced once, together.
  await announcingTogether(() =>
    Promise.all(
      Array.from(
        { length: Math.min(SERVER_CONFIG.INGREDIENT_REVIEW_CONCURRENCY, foods.length) },
        () => fillNext()
      )
    )
  );
  await recording;
  if (unwritten.length > 0) await recordCompletedSteps(job, unwritten);
  signal?.throwIfAborted();
}

export function startIngredientFillWorker(): void {
  createWorker<IngredientFillJobData>(QUEUE_NAMES.INGREDIENT_FILL, processIngredientFillJob);
}
