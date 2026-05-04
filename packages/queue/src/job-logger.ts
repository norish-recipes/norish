/**
 * Job Logger
 *
 * Utility for tracking job execution steps in the database.
 * Workers use this to create a persistent, inspectable record
 * of each job's processing pipeline.
 *
 * Usage:
 * ```ts
 * const logger = await JobLogger.create({
 *   jobId: job.id!,
 *   queueName: "recipe-import",
 *   userId: job.data.userId,
 *   recipeId: job.data.recipeId,
 *   description: job.data.url,
 *   input: { url: job.data.url },
 *   steps: ["fetch_url", "parse_recipe", "save_recipe"],
 * });
 *
 * await logger.startStep("fetch_url");
 * // ... do work
 * await logger.completeStep("fetch_url", { bytesDownloaded: 1234 });
 *
 * await logger.complete({ recipeId: "abc" });
 * ```
 */

import type { JobStepRecord } from "@norish/db/schema/job-logs";
import {
  createJobLog,
  markJobActive,
  markJobCompleted,
  markJobFailed,
  setJobAiModel,
  updateJobSteps,
} from "@norish/db/repositories/job-logs";
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("job-logger");

export interface JobLoggerOptions {
  /** BullMQ job ID */
  jobId: string;
  /** Queue name */
  queueName: string;
  /** User who triggered the job */
  userId: string;
  /** Associated recipe ID (if applicable) */
  recipeId?: string;
  /** Human-readable description (URL, filename, etc.) */
  description?: string;
  /** Sanitized input data */
  input?: Record<string, unknown>;
  /** Ordered list of step names for this job type */
  steps: string[];
}

export class JobLogger {
  private logId: string;
  private steps: JobStepRecord[];
  private queueName: string;

  private constructor(logId: string, steps: JobStepRecord[], queueName: string) {
    this.logId = logId;
    this.steps = steps;
    this.queueName = queueName;
  }

  /**
   * Create a new job log (or reuse existing one for retried jobs) and mark it as active.
   */
  static async create(options: JobLoggerOptions & { attempt?: number }): Promise<JobLogger> {
    const steps: JobStepRecord[] = options.steps.map((name) => ({
      name,
      status: "pending",
    }));

    try {
      // For retried jobs (attempt > 1), find and reuse the existing log entry
      if (options.attempt && options.attempt > 1) {
        const { findJobLogByJobId, markJobActive: reactivate, updateJobSteps: resetSteps } =
          await import("@norish/db/repositories/job-logs");
        const existing = await findJobLogByJobId(options.jobId, options.queueName);

        if (existing) {
          // Reset the log for the new attempt
          await reactivate(existing.id);
          await resetSteps(existing.id, steps);

          log.debug(
            { logId: existing.id, queueName: options.queueName, attempt: options.attempt },
            "Reusing existing job log for retry"
          );

          return new JobLogger(existing.id, steps, options.queueName);
        }
      }

      const logId = await createJobLog({
        jobId: options.jobId,
        queueName: options.queueName,
        userId: options.userId,
        recipeId: options.recipeId ?? null,
        description: options.description ?? null,
        input: options.input ?? null,
        steps,
        status: "active",
        startedAt: new Date(),
      });

      log.debug(
        { logId, queueName: options.queueName, jobId: options.jobId },
        "Job log created"
      );

      return new JobLogger(logId, steps, options.queueName);
    } catch (err) {
      // Don't let logging failures break job processing
      log.error({ err, queueName: options.queueName }, "Failed to create job log");

      // Return a no-op logger
      return new JobLogger("", steps, options.queueName);
    }
  }

  /** Get the database log ID */
  get id(): string {
    return this.logId;
  }

  /**
   * Mark a step as active (started).
   */
  async startStep(stepName: string): Promise<void> {
    if (!this.logId) return;

    const step = this.steps.find((s) => s.name === stepName);

    if (step) {
      step.status = "active";
      step.startedAt = new Date().toISOString();
      await this.persistSteps();
    }
  }

  /**
   * Mark a step as completed with optional output data.
   */
  async completeStep(stepName: string, output?: unknown): Promise<void> {
    if (!this.logId) return;

    const step = this.steps.find((s) => s.name === stepName);

    if (step) {
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      if (output !== undefined) step.output = output;
      await this.persistSteps();
    }
  }

  /**
   * Mark a step as failed with an error message.
   */
  async failStep(stepName: string, error: string): Promise<void> {
    if (!this.logId) return;

    const step = this.steps.find((s) => s.name === stepName);

    if (step) {
      step.status = "failed";
      step.completedAt = new Date().toISOString();
      step.error = error;
      await this.persistSteps();
    }
  }

  /**
   * Mark a step as skipped (e.g. when a condition isn't met).
   */
  async skipStep(stepName: string, reason?: string): Promise<void> {
    if (!this.logId) return;

    const step = this.steps.find((s) => s.name === stepName);

    if (step) {
      step.status = "skipped";
      step.completedAt = new Date().toISOString();
      if (reason) step.output = { reason };
      await this.persistSteps();
    }
  }

  /**
   * Record which AI model was used.
   */
  async setAiModel(model: string): Promise<void> {
    if (!this.logId) return;

    try {
      await setJobAiModel(this.logId, model);
    } catch (err) {
      log.error({ err, logId: this.logId }, "Failed to set AI model");
    }
  }

  /**
   * Mark the job as completed with optional result summary.
   */
  async complete(result?: unknown): Promise<void> {
    if (!this.logId) return;

    // Mark any remaining pending steps as skipped
    for (const step of this.steps) {
      if (step.status === "pending") {
        step.status = "skipped";
      }
    }

    try {
      await this.persistSteps();
      await markJobCompleted(this.logId, result);
      log.debug({ logId: this.logId, queueName: this.queueName }, "Job log completed");
    } catch (err) {
      log.error({ err, logId: this.logId }, "Failed to complete job log");
    }
  }

  /**
   * Mark the job as failed.
   */
  async fail(error: string): Promise<void> {
    if (!this.logId) return;

    // Mark any active/pending steps as failed
    for (const step of this.steps) {
      if (step.status === "active") {
        step.status = "failed";
        step.completedAt = new Date().toISOString();
        step.error = error;
      } else if (step.status === "pending") {
        step.status = "skipped";
      }
    }

    try {
      await this.persistSteps();
      await markJobFailed(this.logId, error);
      log.debug({ logId: this.logId, queueName: this.queueName }, "Job log failed");
    } catch (err) {
      log.error({ err, logId: this.logId }, "Failed to mark job log as failed");
    }
  }

  private async persistSteps(): Promise<void> {
    try {
      await updateJobSteps(this.logId, this.steps);
    } catch (err) {
      log.error({ err, logId: this.logId }, "Failed to persist job steps");
    }
  }
}
