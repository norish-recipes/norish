import type { Queue } from "bullmq";

import type { StoreLookupJobData } from "@norish/queue/contracts/job-types";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

import { SHELF_PRICE_MAX_AGE_MS } from "./lookup";

/**
 * A user's new grocery jumps a batch of stale prices. BullMQ reads a lower
 * number as the more urgent job.
 */
const MATCH_PRIORITY = 1;
const REFRESH_PRIORITY = 5;

/** How soon a shop that did not answer may be asked the same question again. */
export const MATCH_RETRY_WINDOW_MS = 60 * 60 * 1000;

/**
 * The window a job id belongs to. BullMQ keeps a completed job's id for as
 * long as the administrator's retention says — days, on a quiet instance —
 * and refuses to add a job whose id it still holds. An id that is the same
 * every time would therefore run once and never again; an id that carries
 * its window runs once per window, which is exactly as often as it should.
 */
function windowOf(now: number, spanMs: number): number {
  return Math.floor(now / spanMs);
}

/**
 * The pieces of a job id, joined. Never with `:` — BullMQ reserves that for
 * its own repeatable-job ids and refuses a custom id carrying it unless it
 * happens to have exactly three parts, which is a rule to stay well clear of.
 */
function jobId(...parts: string[]): string {
  return parts.join("|");
}

/**
 * **Never enqueue on this queue with `delay`.** A lazy worker wakes on a
 * `waiting` event and a delayed job is only promoted by a running worker, so a
 * delayed job on a sleeping queue sleeps forever
 * (`packages/queue/src/lazy-worker-manager.ts`). This queue is always-on
 * precisely so the work is predictable; scheduling ahead would put the hazard
 * back for no gain.
 */
export async function addStoreMatchJob(
  queue: Queue<StoreLookupJobData>,
  data: Extract<StoreLookupJobData, { kind: "match" }>,
  now: number = Date.now()
): Promise<void> {
  await queue.add("match", data, {
    // One question per store and name, however many groceries asked it — and
    // one per hour, so a shop that did not answer is asked again later
    // rather than never.
    jobId: jobId(
      "match",
      data.storeId,
      String(windowOf(now, MATCH_RETRY_WINDOW_MS)),
      normalizeGroceryName(data.name)
    ),
    priority: MATCH_PRIORITY,
  });
}

export async function addStoreRefreshJob(
  queue: Queue<StoreLookupJobData>,
  data: Extract<StoreLookupJobData, { kind: "refresh" }>,
  now: number = Date.now()
): Promise<void> {
  if (data.productIds.length === 0) return;
  await queue.add("refresh", data, {
    // The same stale set is refreshed once per staleness window, not once ever.
    jobId: jobId(
      "refresh",
      data.storeId,
      String(windowOf(now, SHELF_PRICE_MAX_AGE_MS)),
      data.productIds.slice().sort().join(",")
    ),
    priority: REFRESH_PRIORITY,
  });
}
