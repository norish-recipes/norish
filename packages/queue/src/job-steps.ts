/**
 * Job Step Reporting
 *
 * Workers report their processing steps so the admin job monitor can show a
 * per-attempt pipeline view: which steps ran on each attempt, how long they
 * took, and where a given attempt failed. Progress keeps one timeline per
 * attempt (retries no longer overwrite earlier attempts); job.log keeps a
 * plain-text step history as a fallback.
 */

import type { Job } from "bullmq";

import { createLogger } from "@norish/shared-server/logger";

import type { QueueName } from "./config";
import { QUEUE_NAMES } from "./config";

const log = createLogger("queue:job-steps");

export interface JobStepEvent {
  id: string;
  startedAt: number;
  endedAt?: number;
  /** Small JSON-able summary recorded when the step completed */
  detail?: unknown;
}

export interface JobAttemptTimeline {
  /** 1-based attempt number (job.attemptsMade + 1 at processing time) */
  attempt: number;
  timeline: JobStepEvent[];
}

export interface JobStepProgress {
  /** Current step id (shown in the jobs table) */
  step: string;
  updatedAt: number;
  /** One timeline per attempt, in attempt order */
  attempts: JobAttemptTimeline[];
}

/**
 * Declared step sequence per queue, in execution order. Used to render
 * steps that never ran (skipped/pending) in the pipeline view. Timeline
 * ids are matched on their base id (the part before ":"), so dynamic ids
 * like "creating-recipes:2/5" map onto "creating-recipes".
 */
export const JOB_PIPELINES: Record<QueueName, string[]> = {
  [QUEUE_NAMES.RECIPE_IMPORT]: [
    "dedupe-check",
    "fetch-allergies",
    "parsing",
    "saving",
    "post-processing",
  ],
  [QUEUE_NAMES.IMAGE_IMPORT]: ["preparing-images", "ai-extraction", "saving"],
  [QUEUE_NAMES.PASTE_IMPORT]: ["parsing-text", "creating-recipes", "saving", "post-processing"],
  [QUEUE_NAMES.NUTRITION_ESTIMATION]: ["ai-request", "saving"],
  [QUEUE_NAMES.AUTO_TAGGING]: ["ai-request", "saving"],
  [QUEUE_NAMES.AUTO_CATEGORIZATION]: ["ai-request", "saving"],
  [QUEUE_NAMES.ALLERGY_DETECTION]: ["ai-request", "saving"],
  [QUEUE_NAMES.RECIPE_PROVENANCE]: ["ai-request", "saving"],
  [QUEUE_NAMES.INGREDIENT_LINKING]: ["ai-request", "saving"],
  // CalDAV runs either a sync or a delete flow; no fixed sequence
  [QUEUE_NAMES.CALDAV_SYNC]: [],
  [QUEUE_NAMES.SCHEDULED_TASKS]: ["running"],
};

/**
 * Parse a progress value into step progress, if it has the expected shape.
 * Normalizes the legacy flat `{ step, attempt, timeline }` shape into the
 * per-attempt `attempts` array so old in-flight jobs still render.
 */
export function readStepProgress(progress: unknown): JobStepProgress | null {
  if (
    typeof progress !== "object" ||
    progress === null ||
    !("step" in progress) ||
    typeof (progress as { step: unknown }).step !== "string"
  ) {
    return null;
  }

  const parsed = progress as Partial<JobStepProgress> & {
    attempt?: number;
    timeline?: JobStepEvent[];
  };

  let attempts: JobAttemptTimeline[];

  if (Array.isArray(parsed.attempts)) {
    attempts = parsed.attempts;
  } else if (Array.isArray(parsed.timeline)) {
    // Legacy flat shape → single attempt.
    attempts = [{ attempt: (parsed.attempt ?? 0) + 1, timeline: parsed.timeline }];
  } else {
    attempts = [];
  }

  return {
    step: parsed.step as string,
    updatedAt: parsed.updatedAt ?? 0,
    attempts,
  };
}

/**
 * Extract the current step id from a job's progress value, if present.
 */
export function getJobStep(progress: unknown): string | null {
  return readStepProgress(progress)?.step ?? null;
}

/** Deep-copy the recorded attempts so we can mutate before persisting. */
function cloneAttempts(job: Job): JobAttemptTimeline[] {
  const prev = readStepProgress(job.progress);

  if (!prev) return [];

  return prev.attempts.map((entry) => ({
    attempt: entry.attempt,
    timeline: entry.timeline.map((event) => ({ ...event })),
  }));
}

/** Get (or create) the timeline entry for the job's current attempt. */
function currentAttemptEntry(attempts: JobAttemptTimeline[], job: Job): JobAttemptTimeline {
  const attemptNumber = job.attemptsMade + 1;
  let entry = attempts.find((a) => a.attempt === attemptNumber);

  if (!entry) {
    entry = { attempt: attemptNumber, timeline: [] };
    attempts.push(entry);
  }

  return entry;
}

/**
 * Report that the job is entering a new processing step.
 * Best-effort: monitoring must never fail the job itself.
 */
export async function reportStep(job: Job, step: string): Promise<void> {
  try {
    const now = Date.now();
    const attempts = cloneAttempts(job);
    const entry = currentAttemptEntry(attempts, job);
    const last = entry.timeline[entry.timeline.length - 1];

    if (last && last.endedAt === undefined) {
      last.endedAt = now;
    }

    entry.timeline.push({ id: step, startedAt: now });

    const progress: JobStepProgress = { step, updatedAt: now, attempts };

    const results = await Promise.allSettled([
      job.updateProgress(progress),
      job.log(`${new Date().toISOString()} [attempt ${entry.attempt}] ${step}`),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        log.debug({ err: result.reason, jobId: job.id, step }, "Failed to report job step");
      }
    }
  } catch (err) {
    log.debug({ err, jobId: job.id, step }, "Failed to report job step");
  }
}

/**
 * Mark the current step as completed, optionally attaching a small
 * JSON-able summary shown in the pipeline view (e.g. {alreadyExists: false}).
 * Best-effort: never throws.
 */
export async function completeStep(job: Job, detail?: unknown): Promise<void> {
  try {
    const now = Date.now();
    const prev = readStepProgress(job.progress);

    if (!prev) return;

    const attempts = cloneAttempts(job);
    const entry = currentAttemptEntry(attempts, job);
    const last = entry.timeline[entry.timeline.length - 1];

    if (!last) return;

    last.endedAt = now;

    if (detail !== undefined) {
      last.detail = detail;
    }

    await job.updateProgress({
      step: prev.step,
      updatedAt: now,
      attempts,
    } satisfies JobStepProgress);
  } catch (err) {
    log.debug({ err, jobId: job.id }, "Failed to complete job step");
  }
}
