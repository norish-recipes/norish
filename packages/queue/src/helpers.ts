/**
 * Queue Helpers
 *
 * Shared utilities for BullMQ queue operations.
 */

import type { Queue } from "bullmq";

import type { PermissionLevel } from "@norish/config/zod/server-config";
import { normalizeUrl } from "@norish/shared/lib/helpers";

export function sanitizeUrlForJobId(url: string): string {
  const normalized = normalizeUrl(url);

  return normalized.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9.-]/g, "_");
}

/**
 * The deduplication id of a URL import, scoped by the view policy: one import
 * of a URL in flight at a time, for everyone, per household or per user.
 * BullMQ allows no colons in it, so the parts are joined with underscores.
 */
export function recipeImportDeduplicationId(
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
 * Remove a retained terminal (completed/failed) job occupying the given id.
 *
 * BullMQ treats `queue.add` with an occupied job id as a no-op that returns
 * the existing job, so a job retained for history would silently swallow a
 * re-enqueue under the same deterministic id. Returns true when a retained
 * job was removed, false when the id is free or held by an in-flight job.
 * Throws when the retained job cannot be removed, so callers never report
 * "queued" for an add BullMQ will ignore.
 */
export async function removeRetainedTerminalJob<T>(
  queue: Queue<T>,
  jobId: string
): Promise<boolean> {
  const retained = await queue.getJob(jobId);

  if (!retained) return false;

  const state = await retained.getState();

  if (state !== "completed" && state !== "failed") return false;

  try {
    await retained.remove();

    return true;
  } catch (err) {
    throw new Error(`Could not remove retained job ${jobId}`, { cause: err });
  }
}

/** An error's message, with the cause a wrapper hides: a failed query names the database's complaint. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : null;

  return cause ? `${error.message}: ${cause}` : error.message;
}

/** Whether a job by this name is waiting or running on the queue. */
export async function hasQueuedJobNamed(queue: Queue, name: string): Promise<boolean> {
  const jobs = await queue.getJobs(["active", "waiting", "prioritized", "delayed"], 0, -1);

  return jobs.some((job) => job.name === name);
}
