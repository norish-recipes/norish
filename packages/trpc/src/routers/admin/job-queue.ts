import type { Job, Queue } from "bullmq";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { QueueName } from "@norish/queue/config";
import type { JobStepEvent } from "@norish/queue/job-steps";
import type {
  AdminJobAttemptDTO,
  AdminJobDetailDTO,
  AdminJobRowDTO,
  AdminJobState,
  AdminJobStepDTO,
  AdminJobStepStatus,
  AdminQueueSummaryDTO,
} from "@norish/shared/contracts";
import { JobRetentionConfigSchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { setConfig } from "@norish/db/repositories/server-config";
import { HANGING_THRESHOLD_MS, QUEUE_NAMES } from "@norish/queue/config";
import { getJobStep, JOB_PIPELINES, readStepProgress } from "@norish/queue/job-steps";
import { getAllQueueEntries, getQueueByName } from "@norish/queue/registry";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

const QueueNameSchema = z.enum(Object.values(QUEUE_NAMES) as [QueueName, ...QueueName[]]);

const LISTABLE_STATES = [
  "waiting",
  "active",
  "delayed",
  "completed",
  "failed",
  "paused",
  "prioritized",
] as const;

const JobStateSchema = z.enum(LISTABLE_STATES);

type ListableJobState = (typeof LISTABLE_STATES)[number];

const FAILED_REASON_PREVIEW_LENGTH = 300;
const FAILED_REASON_DETAIL_LENGTH = 10_000;
const MAX_JSON_STRING_LENGTH = 2048;
const MAX_STACKTRACE_ENTRY_LENGTH = 5000;
const MAX_LOG_LINES = 200;

/**
 * Pretty-print a value as JSON, truncating long strings (e.g. base64
 * image payloads) so responses stay small.
 */
function safeStringify(value: unknown, indent: number = 2): string {
  try {
    const json = JSON.stringify(
      value,
      (_key, val: unknown) =>
        typeof val === "string" && val.length > MAX_JSON_STRING_LENGTH
          ? `${val.slice(0, MAX_JSON_STRING_LENGTH)}…[+${val.length - MAX_JSON_STRING_LENGTH} chars]`
          : val,
      indent
    );

    return json ?? "null";
  } catch {
    return String(value);
  }
}

/**
 * Derive a human-readable target from job data without exposing the payload.
 */
function deriveTarget(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;

  const record = data as Record<string, unknown>;

  if (typeof record.url === "string") return record.url;
  if (typeof record.eventTitle === "string") return record.eventTitle;
  if (typeof record.taskType === "string") return record.taskType;
  if (Array.isArray(record.files)) return `[${record.files.length} image(s)]`;
  if (typeof record.recipeId === "string") return record.recipeId;
  if (Array.isArray(record.recipeIds)) {
    const ids = record.recipeIds.filter((id): id is string => typeof id === "string");

    return ids.length > 0 ? `${ids.length} recipe(s)` : null;
  }

  return null;
}

function deriveRecipeId(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;

  const record = data as Record<string, unknown>;

  return typeof record.recipeId === "string" ? record.recipeId : null;
}

/** How a single attempt ended, which drives its last step's status. */
type AttemptOutcome = "failed" | "done" | "running" | "pending";

/**
 * Build the pipeline view for one attempt: steps that ran (from the timeline,
 * with durations and completion details) followed by declared steps that
 * never ran (skipped for a finished attempt, pending for the running one).
 */
function deriveStepsForAttempt(input: {
  queue: QueueName;
  timeline: JobStepEvent[];
  outcome: AttemptOutcome;
  finishedOn: number | null;
  errorMessage: string | null;
}): AdminJobStepDTO[] {
  const { queue, timeline, outcome, finishedOn, errorMessage } = input;
  const now = Date.now();

  const steps: AdminJobStepDTO[] = timeline.map((event, index) => {
    const isLast = index === timeline.length - 1;
    const endedAt =
      event.endedAt ??
      timeline[index + 1]?.startedAt ??
      finishedOn ??
      (outcome === "running" ? now : null);
    const durationMs = endedAt === null ? null : Math.max(0, endedAt - event.startedAt);

    let status: AdminJobStepStatus = "done";

    if (isLast) {
      if (outcome === "running") status = "running";
      else if (outcome === "failed") status = "failed";
      else if (outcome === "done") status = "done";
      else status = "pending";
    }

    return {
      id: event.id,
      status,
      durationMs,
      detailJson: event.detail === undefined ? null : safeStringify(event.detail, 0),
      error: isLast && outcome === "failed" ? errorMessage : null,
    };
  });

  const ranBaseIds = new Set(timeline.map((event) => event.id.split(":")[0]));
  const notRunStatus: AdminJobStepStatus =
    outcome === "running" || outcome === "pending" ? "pending" : "skipped";

  for (const id of JOB_PIPELINES[queue] ?? []) {
    if (!ranBaseIds.has(id)) {
      steps.push({ id, status: notRunStatus, durationMs: null, detailJson: null, error: null });
    }
  }

  return steps;
}

/**
 * Combine per-attempt step timelines (progress) with per-attempt errors
 * (stacktrace) into one attempt list. BullMQ appends a stack per failed
 * attempt (oldest first); every attempt before the last one must have
 * failed to trigger a retry, and the last attempt's outcome is the job's
 * current state.
 */
function deriveAttempts(input: {
  queue: QueueName;
  progress: unknown;
  stacktrace: string[] | null;
  logs: string[];
  state: AdminJobState;
  attemptsMade: number;
  finishedOn: number | null;
}): AdminJobAttemptDTO[] {
  const { queue, progress, state, attemptsMade, finishedOn } = input;
  const timelines = readStepProgress(progress)?.attempts ?? [];
  const stacks = [...(input.stacktrace ?? [])]; // oldest → newest; consumed from the end
  const logsByAttempt = groupLogsByAttempt(input.logs);

  // Attempt numbers present in either source.
  const attemptNumbers = new Set<number>();

  for (const entry of timelines) attemptNumbers.add(entry.attempt);
  // Fall back to attemptsMade so an errored job with no timeline still shows.
  if (attemptNumbers.size === 0 && stacks.length > 0) {
    for (let i = 0; i < stacks.length; i++) attemptNumbers.add(i + 1);
  }

  if (attemptNumbers.size === 0) return [];

  const sorted = [...attemptNumbers].sort((a, b) => a - b);
  const lastAttempt = sorted[sorted.length - 1] ?? attemptsMade;
  const timelineByAttempt = new Map(timelines.map((entry) => [entry.attempt, entry.timeline]));

  const lastOutcome: AttemptOutcome =
    state === "active"
      ? "running"
      : state === "completed"
        ? "done"
        : state === "failed"
          ? "failed"
          : "pending";

  // Assign stacks to failed attempts newest-first.
  const attempts: AdminJobAttemptDTO[] = [];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const attempt = sorted[i]!;
    const outcome: AttemptOutcome = attempt === lastAttempt ? lastOutcome : "failed";

    let message: string | null = null;
    let stack: string | null = null;

    if (outcome === "failed" && stacks.length > 0) {
      stack = stacks.pop()!.slice(0, MAX_STACKTRACE_ENTRY_LENGTH);
      message = stack.split("\n")[0]?.trim() ?? "";
    }

    attempts.push({
      attempt,
      message,
      stack,
      steps: deriveStepsForAttempt({
        queue,
        timeline: timelineByAttempt.get(attempt) ?? [],
        outcome,
        finishedOn: attempt === lastAttempt ? finishedOn : null,
        errorMessage: message,
      }),
      logs: logsByAttempt.get(attempt) ?? [],
    });
  }

  return attempts.reverse();
}

/**
 * Group flat job logs by attempt. Worker logs are prefixed `[attempt N]`;
 * lines before the first marker (or from legacy jobs) carry forward to the
 * last-seen attempt, defaulting to attempt 1. The prefix is stripped.
 */
function groupLogsByAttempt(logs: string[]): Map<number, string[]> {
  const byAttempt = new Map<number, string[]>();
  let current = 1;

  for (const line of logs) {
    const match = line.match(/\[attempt (\d+)\]/);

    if (match) current = Number(match[1]);

    const cleaned = line.replace(/\s*\[attempt \d+\]/, "");
    const bucket = byAttempt.get(current) ?? [];

    bucket.push(cleaned);
    byAttempt.set(current, bucket);
  }

  return byAttempt;
}

function toRowDTO(queueName: QueueName, job: Job, state: AdminJobState): AdminJobRowDTO {
  const now = Date.now();
  const processedOn = job.processedOn ?? null;
  const finishedOn = job.finishedOn ?? null;

  let durationMs: number | null = null;

  if (processedOn !== null) {
    durationMs = (finishedOn ?? now) - processedOn;
  }

  const isHanging =
    state === "active" &&
    processedOn !== null &&
    now - processedOn > HANGING_THRESHOLD_MS[queueName];

  const failedReason = job.failedReason
    ? job.failedReason.slice(0, FAILED_REASON_PREVIEW_LENGTH)
    : null;

  // For delayed jobs (incl. the next occurrence of a repeatable/cron job),
  // job.delay is milliseconds from job.timestamp until it becomes runnable.
  const runAt = state === "delayed" ? job.timestamp + job.delay : null;

  return {
    queue: queueName,
    id: job.id ?? "",
    name: job.name,
    target: deriveTarget(job.data),
    recipeId: deriveRecipeId(job.data),
    state,
    isHanging,
    step: getJobStep(job.progress),
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 1,
    createdAt: job.timestamp,
    processedOn,
    finishedOn,
    durationMs,
    failedReason,
    isRepeat: job.repeatJobKey != null,
    runAt,
  };
}

async function resolveState(job: Job, requestedStates?: ListableJobState[]): Promise<AdminJobState> {
  // Fast path: a single-state filter already tells us the state
  if (requestedStates?.length === 1) {
    return requestedStates[0] as AdminJobState;
  }

  try {
    return (await job.getState()) as AdminJobState;
  } catch {
    return "unknown";
  }
}

async function getJobOrThrow(queueName: QueueName, jobId: string): Promise<{ queue: Queue; job: Job }> {
  const queue = getQueueByName(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Job ${jobId} not found in ${queueName}` });
  }

  return { queue, job };
}

/**
 * List jobs across queues, newest first.
 */
const list = adminProcedure
  .input(
    z.object({
      queue: QueueNameSchema.optional(),
      states: z.array(JobStateSchema).min(1).optional(),
      limit: z.number().int().min(1).max(200).default(50),
    })
  )
  .query(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, input }, "Listing jobs for admin monitor");

    const entries = input.queue
      ? [{ name: input.queue, queue: getQueueByName(input.queue) }]
      : getAllQueueEntries();

    const states = input.states ?? [...LISTABLE_STATES];

    const perQueue = await Promise.all(
      entries.map(async ({ name, queue }) => {
        const jobs = await queue.getJobs(states, 0, input.limit - 1);

        return Promise.all(
          jobs
            .filter((job): job is Job => Boolean(job?.id))
            .map(async (job) => toRowDTO(name, job, await resolveState(job, input.states)))
        );
      })
    );

    return perQueue
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, input.limit);
  });

/**
 * Full job detail including payload, per-attempt steps/errors, and logs.
 */
const detail = adminProcedure
  .input(z.object({ queue: QueueNameSchema, jobId: z.string().min(1) }))
  .query(async ({ ctx, input }): Promise<AdminJobDetailDTO> => {
    log.debug({ userId: ctx.user.id, ...input }, "Fetching job detail for admin monitor");

    const { queue, job } = await getJobOrThrow(input.queue, input.jobId);

    const [state, jobLogs] = await Promise.all([
      resolveState(job),
      queue.getJobLogs(input.jobId, 0, MAX_LOG_LINES - 1),
    ]);

    const row = toRowDTO(input.queue, job, state);
    const fullFailedReason = job.failedReason
      ? job.failedReason.slice(0, FAILED_REASON_DETAIL_LENGTH)
      : null;

    return {
      ...row,
      failedReason: fullFailedReason,
      dataJson: safeStringify(job.data),
      returnValueJson: job.returnvalue == null ? null : safeStringify(job.returnvalue),
      attempts: deriveAttempts({
        queue: input.queue,
        progress: job.progress,
        stacktrace: job.stacktrace ?? null,
        logs: jobLogs.logs,
        state,
        attemptsMade: job.attemptsMade,
        finishedOn: row.finishedOn,
      }),
      logsTotal: jobLogs.count,
      optsJson: safeStringify(job.opts),
    };
  });

/**
 * Re-run a failed job.
 */
const retry = adminProcedure
  .input(z.object({ queue: QueueNameSchema, jobId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Admin retrying job");

    const { job } = await getJobOrThrow(input.queue, input.jobId);
    const state = await job.getState();

    if (state !== "failed") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Only failed jobs can be retried (job is ${state})`,
      });
    }

    await job.retry();

    return { success: true };
  });

/**
 * Remove a job from its queue.
 */
const remove = adminProcedure
  .input(z.object({ queue: QueueNameSchema, jobId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Admin removing job");

    const { job } = await getJobOrThrow(input.queue, input.jobId);

    if (job.repeatJobKey != null) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Repeat jobs are managed by the scheduler and cannot be removed",
      });
    }

    const state = await job.getState();

    if (state === "active") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Active jobs cannot be removed",
      });
    }

    try {
      await job.remove();
    } catch (err) {
      // BullMQ throws when the job is locked (e.g. became active mid-request)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: err instanceof Error ? err.message : "Failed to remove job",
      });
    }

    return { success: true };
  });

/**
 * Per-queue job counts with hanging detection.
 */
const summary = adminProcedure.query(async ({ ctx }): Promise<AdminQueueSummaryDTO[]> => {
  log.debug({ userId: ctx.user.id }, "Fetching queue summary for admin monitor");

  const now = Date.now();

  return Promise.all(
    getAllQueueEntries().map(async ({ name, queue }) => {
      const [counts, activeJobs] = await Promise.all([
        queue.getJobCounts(...LISTABLE_STATES),
        queue.getJobs(["active"]),
      ]);

      const hangingCount = activeJobs.filter(
        (job) => job?.processedOn != null && now - job.processedOn > HANGING_THRESHOLD_MS[name]
      ).length;

      return {
        queue: name,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          paused: counts.paused ?? 0,
          prioritized: counts.prioritized ?? 0,
        },
        hangingCount,
      };
    })
  );
});

/**
 * Update the job retention config (requires restart to take effect).
 */
const updateRetention = adminProcedure
  .input(JobRetentionConfigSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, retention: input }, "Updating job retention config");

    await setConfig(ServerConfigKeys.JOB_RETENTION, input, ctx.user.id, false);

    return { success: true };
  });

export const jobQueueProcedures = router({
  list,
  detail,
  retry,
  remove,
  summary,
  updateRetention,
});
