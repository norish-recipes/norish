import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { JobStepRecord, NewJobLog } from "../schema/job-logs";
import { db } from "../drizzle";
import { jobLogs } from "../schema/job-logs";

/**
 * Create a new job log entry when a job is queued.
 */
export async function createJobLog(data: NewJobLog): Promise<string> {
  const [row] = await db.insert(jobLogs).values(data).returning({ id: jobLogs.id });

  return row!.id;
}

/**
 * Mark a job as active (started processing).
 */
export async function markJobActive(id: string): Promise<void> {
  await db
    .update(jobLogs)
    .set({ status: "active", startedAt: new Date() })
    .where(eq(jobLogs.id, id));
}

/**
 * Mark a job as completed.
 */
export async function markJobCompleted(
  id: string,
  result?: unknown
): Promise<void> {
  await db
    .update(jobLogs)
    .set({
      status: "completed",
      completedAt: new Date(),
      result: result ?? null,
    })
    .where(eq(jobLogs.id, id));
}

/**
 * Mark a job as failed.
 */
export async function markJobFailed(id: string, error: string): Promise<void> {
  await db
    .update(jobLogs)
    .set({
      status: "failed",
      completedAt: new Date(),
      error,
    })
    .where(eq(jobLogs.id, id));
}

/**
 * Update the steps array for a job log.
 */
export async function updateJobSteps(
  id: string,
  steps: JobStepRecord[]
): Promise<void> {
  await db.update(jobLogs).set({ steps }).where(eq(jobLogs.id, id));
}

/**
 * Set the AI model used for a job.
 */
export async function setJobAiModel(id: string, aiModel: string): Promise<void> {
  await db.update(jobLogs).set({ aiModel }).where(eq(jobLogs.id, id));
}

/**
 * List job logs with pagination and optional filters.
 */
export async function listJobLogs(options: {
  limit?: number;
  offset?: number;
  queueName?: string;
  status?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
}): Promise<{ jobs: typeof jobLogs.$inferSelect[]; total: number }> {
  const {
    limit = 20,
    offset = 0,
    queueName,
    status,
    userId,
    fromDate,
    toDate,
  } = options;

  const conditions = [];

  if (queueName) conditions.push(eq(jobLogs.queueName, queueName));
  if (status) conditions.push(eq(jobLogs.status, status as any));
  if (userId) conditions.push(eq(jobLogs.userId, userId));
  if (fromDate) conditions.push(gte(jobLogs.createdAt, fromDate));
  if (toDate) conditions.push(lte(jobLogs.createdAt, toDate));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [jobs, countResult] = await Promise.all([
    db
      .select()
      .from(jobLogs)
      .where(where)
      .orderBy(desc(jobLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobLogs)
      .where(where),
  ]);

  return { jobs, total: countResult[0]?.count ?? 0 };
}

/**
 * Get a single job log by ID.
 */
export async function getJobLog(id: string) {
  const [row] = await db.select().from(jobLogs).where(eq(jobLogs.id, id)).limit(1);

  return row ?? null;
}

/**
 * Get job stats (counts by status and queue).
 */
export async function getJobStats(): Promise<{
  byStatus: Record<string, number>;
  byQueue: Record<string, number>;
}> {
  const [statusCounts, queueCounts] = await Promise.all([
    db
      .select({
        status: jobLogs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(jobLogs)
      .groupBy(jobLogs.status),
    db
      .select({
        queueName: jobLogs.queueName,
        count: sql<number>`count(*)::int`,
      })
      .from(jobLogs)
      .groupBy(jobLogs.queueName),
  ]);

  const byStatus: Record<string, number> = {};

  for (const row of statusCounts) {
    byStatus[row.status] = row.count;
  }

  const byQueue: Record<string, number> = {};

  for (const row of queueCounts) {
    byQueue[row.queueName] = row.count;
  }

  return { byStatus, byQueue };
}

/**
 * Delete job logs older than the given date.
 * Used by the scheduled cleanup task.
 */
export async function deleteOldJobLogs(olderThan: Date): Promise<number> {
  const result = await db
    .delete(jobLogs)
    .where(lte(jobLogs.createdAt, olderThan))
    .returning({ id: jobLogs.id });

  return result.length;
}

/**
 * Find a job log by BullMQ job ID and queue name.
 */
export async function findJobLogByJobId(
  jobId: string,
  queueName: string
) {
  const [row] = await db
    .select()
    .from(jobLogs)
    .where(and(eq(jobLogs.jobId, jobId), eq(jobLogs.queueName, queueName)))
    .limit(1);

  return row ?? null;
}
