/**
 * Ingredient Review Worker
 *
 * A round of Ask AI over Flagged Ingredients (ADR-0037), one job for however
 * many foods a person asked about, one step per food. Each food is asked the
 * question the Ingredients page's own Ask AI asks, a few at once, and a sure
 * answer is left as a suggestion for a person to confirm. The round's count
 * follows over the socket as answers come, and the changes are announced
 * together once every food is answered, so the suggestions arrive as one. The round outlives the tab that started it. A food no
 * longer flagged, or one the asker may not edit, is passed over, and a food
 * whose question or edit broke is recorded as failed on its own step, with
 * the cause; neither ends the round. Only the round's own bookkeeping can fail
 * it, and the retry asks again, replacing the suggestions it left. Uses the lazy
 * worker pattern, which wraps the processor so the models each question asks
 * reach the job monitor.
 */

import type { Job } from "bullmq";

import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";
import type { ReviewOutcome } from "@norish/shared-server/ingredients/review";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { CatalogueEditError } from "@norish/shared-server/ingredients/catalogue";
import { findParentWithAI, reviewFlaggedWithAI } from "@norish/shared-server/ingredients/review";
import { createLogger } from "@norish/shared-server/logger";
import { ingredients } from "@norish/shared-server/realtime/ingredients";

import type { ReviewStepDetail } from "./progress";
import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { completeStep, reportStep } from "../job-steps";
import { REVIEW_STEP, summarizeReviewRound } from "./progress";

const log = createLogger("worker:ingredient-review");

/** An error's message, with the cause a wrapper hides: a failed query names the database's complaint. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : null;

  return cause ? `${error.message}: ${cause}` : error.message;
}

/**
 * The question, asked of one food. Nothing here ends the round: a refusal is
 * the food's, and an error — the model, the database — is recorded on the
 * food's step for the monitor and counted, so the other foods still get asked.
 */
async function ask(
  job: Job<IngredientReviewJobData>,
  ingredientId: string
): Promise<ReviewStepDetail> {
  try {
    const outcome: ReviewOutcome =
      job.data.mode === "parent"
        ? await findParentWithAI(job.data.actor, ingredientId)
        : await reviewFlaggedWithAI(job.data.actor, ingredientId);

    if (outcome.outcome === "not-flagged") {
      return { ingredientId, outcome: "skipped", reason: "not-flagged" };
    }

    return { ingredientId, ...outcome };
  } catch (error) {
    if (
      error instanceof CatalogueEditError &&
      (error.refusal === "forbidden" || error.refusal === "not-found")
    ) {
      return { ingredientId, outcome: "skipped", reason: error.refusal };
    }
    log.error({ err: error, jobId: job.id, ingredientId }, "Asking AI about a food failed");

    return { ingredientId, outcome: "failed", error: describe(error) };
  }
}

/** Tell every open page how far the round is. Best-effort: the round itself has gone through. */
async function announceRound(job: Job<IngredientReviewJobData>, finished: boolean): Promise<void> {
  try {
    await ingredients.publish("review", summarizeReviewRound(job, finished), undefined);
  } catch (error) {
    log.warn({ err: error, jobId: job.id }, "Could not announce the round's progress");
  }
}

/**
 * How many foods are asked about at once (`INGREDIENT_REVIEW_CONCURRENCY`).
 * The questions are independent, so a round of twenty takes a couple of
 * questions' time rather than twenty; a self-hosted model that struggles
 * with parallel requests gets a lower number.
 */
function reviewConcurrency(): number {
  return SERVER_CONFIG.INGREDIENT_REVIEW_CONCURRENCY;
}

/** Exported so the job body can be exercised without a Redis-backed worker. */
export async function processIngredientReviewJob(job: Job<IngredientReviewJobData>): Promise<void> {
  const { ingredients: foods } = job.data;
  const changed: string[] = [];
  let next = 0;
  let settled = 0;
  // The job's steps are a timeline, one open at a time: answers are written to it in turn.
  let recording = Promise.resolve();

  log.info({ jobId: job.id, count: foods.length }, "Asking AI about flagged Ingredients");

  const record = (food: { id: string; name: string }, detail: ReviewStepDetail) => {
    recording = recording.then(async () => {
      settled += 1;
      await reportStep(job, `${REVIEW_STEP}:${settled}/${foods.length}`, {
        ingredientId: food.id,
        name: food.name,
      });
      await completeStep(job, detail);
      // A suggestion recorded, or a flag's reason brought up to date, is worth announcing.
      if (detail.outcome !== "skipped" && detail.outcome !== "failed") changed.push(food.id);
      // The count follows as answers come; the answers themselves land together at the end.
      if (settled < foods.length) await announceRound(job, false);
    });

    return recording;
  };

  const askNext = async (): Promise<void> => {
    while (next < foods.length) {
      const food = foods[next++]!;

      await record(food, await ask(job, food.id));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(reviewConcurrency(), foods.length) }, () => askNext())
  );
  await recording;

  if (changed.length > 0) {
    try {
      await ingredients.publish("changed", { ingredientIds: changed }, undefined);
    } catch (error) {
      log.warn({ err: error, jobId: job.id }, "Could not announce the round's Ingredient changes");
    }
  }
  await announceRound(job, true);
}

/**
 * A round that gave up ends on every open page too, at the count it reached.
 * An attempt that will be retried says nothing: the round is still on.
 */
export async function handleIngredientReviewFailure(
  job: Job<IngredientReviewJobData> | undefined,
  error: Error
): Promise<void> {
  log.error({ jobId: job?.id, err: error }, "A round of Ask AI failed");
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  await announceRound(job, true);
}

const ingredientReviewWorker = defineLazyWorker<IngredientReviewJobData>(
  QUEUE_NAMES.INGREDIENT_REVIEW,
  processIngredientReviewJob,
  handleIngredientReviewFailure
);

export const startIngredientReviewWorker = ingredientReviewWorker.start;
export const stopIngredientReviewWorker = ingredientReviewWorker.stop;
