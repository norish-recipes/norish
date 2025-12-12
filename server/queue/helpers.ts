/**
 * Queue Helpers
 *
 * Shared utilities for BullMQ queue operations.
 */

import type { Queue } from "bullmq";
import type { PermissionLevel } from "@/server/db/zodSchemas/server-config";

import { normalizeUrl } from "@/lib/helpers";

/**
 * Generate a unique job ID based on the view policy.
 *
 * - "everyone": `import:${normalizedUrl}` - globally unique
 * - "household": `import:${householdKey}:${normalizedUrl}` - unique per household
 * - "owner": `import:${userId}:${normalizedUrl}` - unique per user
 */
export function generateJobId(
  url: string,
  userId: string,
  householdKey: string,
  viewPolicy: PermissionLevel
): string {
  const normalized = normalizeUrl(url);

  switch (viewPolicy) {
    case "everyone":
      return `import:${normalized}`;
    case "household":
      return `import:${householdKey}:${normalized}`;
    case "owner":
      return `import:${userId}:${normalized}`;
    default:
      // Default policy
      return `import:${normalized}`;
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
