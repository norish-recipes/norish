/**
 * What a round of Ask AI has come to, read off the job's own step progress:
 * one step per food, "asking-ai:3/12", completed with what came of it. The
 * worker publishes this after every food, and the Ingredients page asks for it
 * when it opens, so a tab opened mid-round, or a housemate's, shows the same
 * count the tab that started the round does.
 */

import type { Job, Queue } from "bullmq";

import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";
import type {
  ReviewReport,
  ReviewReportEntry,
} from "@norish/shared/contracts/ingredient-catalogue";
import type { ReviewRound } from "@norish/shared/contracts/realtime/ingredients";

import { readStepProgress } from "../job-steps";

/** The base id of every food's step; the food's place in the round follows a colon. */
export const REVIEW_STEP = "asking-ai";

/**
 * What a food's completed step records, for the job monitor and the round's
 * report: the verdict and the food it names, what AI read the name as and
 * which foods it was asked to compare it with; or why the food was passed
 * over; or what broke, with the cause behind a wrapped error, since "Failed
 * query" alone says nothing. One shape with the report entry the page reads.
 */
export type ReviewStepDetail = ReviewReportEntry;

type ReviewCounts = ReviewRound["counts"];

/** Which count each settled outcome adds to. */
const COUNTED: Record<Exclude<ReviewStepDetail["outcome"], never>, keyof ReviewCounts> = {
  merge: "merge",
  parent: "parent",
  distinct: "distinct",
  unsure: "unsure",
  skipped: "skipped",
  failed: "failed",
};

function isCounted(value: unknown): value is ReviewStepDetail["outcome"] {
  return typeof value === "string" && value in COUNTED;
}

/** The foods the latest attempt has settled, in the order it took them, with what came of each. */
function settledSteps(progress: unknown): ReviewStepDetail[] {
  const attempts = readStepProgress(progress)?.attempts ?? [];
  const latest = attempts[attempts.length - 1];
  const settled: ReviewStepDetail[] = [];

  for (const step of latest?.timeline ?? []) {
    if (!step.id.startsWith(REVIEW_STEP) || step.endedAt === undefined) continue;
    const detail = step.detail as Partial<ReviewStepDetail> | undefined;

    if (!detail || typeof detail.ingredientId !== "string" || !isCounted(detail.outcome)) continue;
    settled.push(detail as ReviewStepDetail);
  }

  return settled;
}

/**
 * The round as the job's progress tells it. Only the latest attempt counts:
 * a retry starts the walk over, asking again about the foods the first
 * attempt reached, whose suggestions it replaces.
 */
export function summarizeReviewRound(
  job: Pick<Job<IngredientReviewJobData>, "id" | "data" | "progress">,
  finished: boolean
): ReviewRound {
  const counts: ReviewCounts = {
    merge: 0,
    parent: 0,
    distinct: 0,
    unsure: 0,
    skipped: 0,
    failed: 0,
  };
  const settled = settledSteps(job.progress);
  const done = settled.length;
  // Every food answered is a round over, even while the job is still winding up:
  // a page that asks then would otherwise see every row waiting again.
  const over = finished || done >= job.data.ingredients.length;

  for (const step of settled) counts[COUNTED[step.outcome]] += 1;

  return {
    jobId: job.id ?? "",
    done,
    total: job.data.ingredients.length,
    counts,
    // Every food waits until the round ends: its answer lands with the others'.
    pending: over ? [] : job.data.ingredients.map((food) => food.id),
    finished: over,
  };
}

/** The round running or waiting on this instance, if any: one runs at a time. */
export async function findRunningReviewRound(
  queue: Queue<IngredientReviewJobData>
): Promise<ReviewRound | null> {
  const [job] = await queue.getJobs(["active", "waiting", "prioritized", "delayed"], 0, 0, true);

  const round = job ? summarizeReviewRound(job, false) : null;

  // A round whose every food is answered is no longer running.
  return round && !round.finished ? round : null;
}

/**
 * A round read back once it is over, or as far as it has come: what AI did
 * to each food and how. Nothing for a job the queue no longer holds; a round
 * is kept as long as any job is.
 */
export async function readReviewReport(
  queue: Queue<IngredientReviewJobData>,
  jobId: string
): Promise<ReviewReport | null> {
  const job = await queue.getJob(jobId);

  if (!job) return null;
  const state = await job.getState();

  return {
    jobId,
    finished: state === "completed" || state === "failed",
    entries: settledSteps(job.progress),
  };
}
