/**
 * Queue Helpers
 *
 * Shared utilities for BullMQ queue operations.
 */

import type { Queue } from "bullmq";
import type { PermissionLevel } from "@/server/db/zodSchemas/server-config";

import { normalizeUrl } from "@/lib/helpers";

export function sanitizeUrlForJobId(url: string): string {
  const normalized = normalizeUrl(url);

  return normalized.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9.-]/g, "_");
}

/**
 * Generate a unique job ID based on the view policy.
 * Note: BullMQ doesn't allow colons in job IDs, so we use underscores as delimiters.
 *
 * - "everyone": `import_${sanitizedUrl}` - globally unique
 * - "household": `import_${householdKey}_${sanitizedUrl}` - unique per household
 * - "owner": `import_${userId}_${sanitizedUrl}` - unique per user
 */
export function generateJobId(
  url: string,
  userId: string,
  householdKey: string,
  viewPolicy: PermissionLevel
): string {
  const sanitized = sanitizeUrlForJobId(url);

  switch (viewPolicy) {
    case "everyone":
      return `import_${sanitized}`;
    case "household":
      return `import_${householdKey}_${sanitized}`;
    case "owner":
      return `import_${userId}_${sanitized}`;
    default:
      return `import_${sanitized}`;
  }
}

/**
 * Check if a job with the given ID is currently in the queue
 * (waiting, active, or delayed - not completed or failed)
 */
export async function isJobInQueue<T>(queue: Queue<T>, jobId: string): Promise<boolean> {
  const job = await queue.getJob(jobId);

  if (!job) return false;

  const state = await job.getState();

  return state === "waiting" || state === "active" || state === "delayed";
}
