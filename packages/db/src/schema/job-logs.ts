import crypto from "crypto";
import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Job status enum for background queue jobs.
 */
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "active",
  "completed",
  "failed",
]);

/**
 * Step status enum for individual job steps.
 */
export const jobStepStatusEnum = pgEnum("job_step_status", [
  "pending",
  "active",
  "completed",
  "failed",
  "skipped",
]);

/**
 * Persistent job logs for background queue processing.
 *
 * Stores a record of every background job with its steps,
 * inputs, outputs, errors, and timing information.
 * Used by the admin UI to inspect current and past jobs.
 */
export const jobLogs = pgTable(
  "job_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** BullMQ job ID */
    jobId: text("job_id").notNull(),
    /** Queue name (e.g. "recipe-import", "image-recipe-import") */
    queueName: text("queue_name").notNull(),
    /** Current job status */
    status: jobStatusEnum("status").notNull().default("queued"),
    /** User who triggered the job */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Associated recipe ID (if applicable) */
    recipeId: text("recipe_id"),
    /** Human-readable job description (e.g. URL, filename) */
    description: text("description"),
    /** Job input data (sanitized - no secrets) */
    input: jsonb("input"),
    /**
     * Steps array - each step is:
     * { name: string, status: string, startedAt?: string, completedAt?: string, output?: any, error?: string }
     */
    steps: jsonb("steps").$type<JobStepRecord[]>().default([]),
    /** Final result/output summary */
    result: jsonb("result"),
    /** Error message if job failed */
    error: text("error"),
    /** AI model used (if applicable) */
    aiModel: text("ai_model"),
    /** When the job started processing */
    startedAt: timestamp("started_at", { withTimezone: true }),
    /** When the job finished (success or failure) */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** When the job was created/queued */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("job_logs_queue_name_idx").on(t.queueName),
    index("job_logs_status_idx").on(t.status),
    index("job_logs_user_id_idx").on(t.userId),
    index("job_logs_recipe_id_idx").on(t.recipeId),
    index("job_logs_created_at_idx").on(t.createdAt),
  ]
);

/**
 * Type for a single step record stored in the steps JSONB column.
 */
export interface JobStepRecord {
  name: string;
  status: "pending" | "active" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  /** Step output/data (kept small - summaries, not full payloads) */
  output?: unknown;
  /** Error message if step failed */
  error?: string;
}

export type JobLog = typeof jobLogs.$inferSelect;
export type NewJobLog = typeof jobLogs.$inferInsert;
