import { z } from "zod";

import {
  deleteOldJobLogs,
  getJobLog,
  getJobStats,
  listJobLogs,
} from "@norish/db/repositories/job-logs";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * List jobs with pagination and optional filters.
 */
const listJobs = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      queueName: z.string().optional(),
      status: z.enum(["queued", "active", "completed", "failed"]).optional(),
      userId: z.string().optional(),
      fromDate: z.string().datetime().optional(),
      toDate: z.string().datetime().optional(),
    })
  )
  .query(async ({ input }) => {
    const result = await listJobLogs({
      limit: input.limit,
      offset: input.offset,
      queueName: input.queueName,
      status: input.status,
      userId: input.userId,
      fromDate: input.fromDate ? new Date(input.fromDate) : undefined,
      toDate: input.toDate ? new Date(input.toDate) : undefined,
    });

    return result;
  });

/**
 * Get detailed view of a single job.
 */
const getJob = adminProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input }) => {
    const job = await getJobLog(input.id);

    return job;
  });

/**
 * Get aggregate job stats (counts by status and queue).
 */
const stats = adminProcedure.query(async () => {
  return getJobStats();
});

/**
 * Manually purge old job logs.
 */
const purgeOldJobs = adminProcedure
  .input(
    z.object({
      olderThanDays: z.number().min(1).max(365).default(30),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const cutoff = new Date();

    cutoff.setDate(cutoff.getDate() - input.olderThanDays);

    log.info(
      { userId: ctx.user.id, olderThanDays: input.olderThanDays },
      "Purging old job logs"
    );

    const deleted = await deleteOldJobLogs(cutoff);

    return { deleted };
  });

export const jobsProcedures = router({
  listJobs,
  getJob,
  stats,
  purgeOldJobs,
});
