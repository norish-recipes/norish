import { createClientLogger } from "@norish/shared/lib/logger";

import type { OutboxItem } from "./outbox-types";
import * as outboxStore from "./outbox-store";

const log = createClientLogger("outbox-replay");

// ---------------------------------------------------------------------------
// Retry delay
// ---------------------------------------------------------------------------

/** Base delay in milliseconds for incremental backoff. */
const BASE_DELAY_MS = 2_000;
/** Maximum delay cap. */
const MAX_DELAY_MS = 60_000;
/** Maximum number of replay failures before an item is dropped. */
const MAX_REPLAY_ATTEMPTS = 2;

/**
 * Compute the next retry delay based on the current attempt count.
 * Uses exponential backoff capped at MAX_DELAY_MS.
 */
export function computeRetryDelay(attempts: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Replay callback type
// ---------------------------------------------------------------------------

/**
 * A function that replays a single outbox item by re-submitting the original
 * tRPC mutation. Returns `true` if the backend acknowledged the request
 * successfully, `false` otherwise.
 */
export type ReplayFn = (item: OutboxItem) => Promise<boolean>;

export type DrainQueueResult = {
  hadPendingItems: boolean;
  drained: boolean;
  pendingItems: number;
  scheduledRetryAt: string | null;
};

// ---------------------------------------------------------------------------
// Coordinator state
// ---------------------------------------------------------------------------

let replayFn: ReplayFn | null = null;
let processingPromise: Promise<DrainQueueResult> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledRetryAt: number | null = null;

function createDrainQueueResult(hadPendingItems: boolean): DrainQueueResult {
  const pendingItems = outboxStore.size();

  return {
    hadPendingItems,
    drained: pendingItems === 0,
    pendingItems,
    scheduledRetryAt: scheduledRetryAt === null ? null : new Date(scheduledRetryAt).toISOString(),
  };
}

/**
 * Returns a Promise that resolves once the current outbox processing run
 * completes. If no run is in progress one is started first. The result
 * reports whether the queue fully drained or whether items remain queued for
 * a later retry.
 */
export function drainQueue(): Promise<DrainQueueResult> {
  if (processingPromise) {
    return processingPromise;
  }

  return processQueue();
}

/**
 * Register the function used to actually submit replayed mutations.
 * Must be called once during app initialization (e.g. in TrpcProvider setup).
 */
export function setReplayFn(fn: ReplayFn): void {
  replayFn = fn;
}

/**
 * Whether the coordinator is currently processing the queue.
 */
export function isProcessing(): boolean {
  return processingPromise !== null;
}

function clearScheduledReplay(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  scheduledRetryAt = null;
}

function trackEarlierRetry(current: number | null, candidate: number | null): number | null {
  if (candidate === null) {
    return current;
  }

  if (current === null) {
    return candidate;
  }

  return Math.min(current, candidate);
}

function scheduleReplayAt(timestampMs: number, reason: string): void {
  const delay = Math.max(0, timestampMs - Date.now());

  if (scheduledRetryAt === timestampMs && retryTimer) {
    return;
  }

  clearScheduledReplay();

  scheduledRetryAt = timestampMs;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    scheduledRetryAt = null;
    log.debug(`Retry timer fired (${reason}), processing outbox`);
    void processQueue();
  }, delay);

  log.debug(`Scheduled outbox retry in ${delay}ms (${reason})`);
}

// ---------------------------------------------------------------------------
// Core processing loop
// ---------------------------------------------------------------------------

/**
 * Process all eligible outbox items in stored order.
 *
 * - Skips items whose `nextRetryAt` is in the future.
 * - Removes items that succeed.
 * - Bumps retry metadata on items that fail.
 * - Drops items that exceed the max replay attempts.
 * - Stops on the first retryable failure to avoid hammering an unreachable backend.
 * - Continues after dropped items so one poisoned entry does not block the queue.
 */
export function processQueue(): Promise<DrainQueueResult> {
  if (processingPromise) {
    log.debug("Replay already in progress, skipping");

    return processingPromise;
  }

  processingPromise = runProcessQueue().finally(() => {
    processingPromise = null;
  });

  return processingPromise;
}

async function runProcessQueue(): Promise<DrainQueueResult> {
  const hadPendingItems = outboxStore.size() > 0;

  if (!replayFn) {
    log.warn({}, "No replay function registered, skipping outbox processing");

    return createDrainQueueResult(hadPendingItems);
  }

  clearScheduledReplay();

  const items = outboxStore.loadAll();
  let nextScheduledRetry: number | null = null;

  if (items.length === 0) {
    return createDrainQueueResult(false);
  }

  log.debug(`Processing outbox: ${items.length} item(s) pending`);

  const now = Date.now();

  for (const item of items) {
    // Skip items not yet eligible for retry
    if (item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now) {
      nextScheduledRetry = trackEarlierRetry(
        nextScheduledRetry,
        new Date(item.nextRetryAt).getTime()
      );
      log.debug(`Skipping item ${item.id}: next retry at ${item.nextRetryAt}`);

      continue;
    }

    log.debug(`Replaying item ${item.id}: ${item.path} (attempt ${item.attempts + 1})`);

    const success = await replayFn(item);

    if (success) {
      outboxStore.remove(item.id);
      log.debug(`Item ${item.id} replayed successfully, removed from outbox`);
    } else {
      const newAttempts = item.attempts + 1;

      if (newAttempts >= MAX_REPLAY_ATTEMPTS) {
        outboxStore.remove(item.id);
        log.warn(
          { itemId: item.id, path: item.path, attempts: newAttempts },
          "Outbox replay hit max attempts; dropping item"
        );

        continue;
      }

      const delay = computeRetryDelay(newAttempts);
      const nextRetryAt = new Date(Date.now() + delay).toISOString();

      outboxStore.update(item.id, {
        attempts: newAttempts,
        nextRetryAt,
      });

      nextScheduledRetry = trackEarlierRetry(nextScheduledRetry, new Date(nextRetryAt).getTime());

      log.debug(`Item ${item.id} replay failed (attempt ${newAttempts}), next retry in ${delay}ms`);

      break;
    }
  }

  if (nextScheduledRetry !== null) {
    scheduleReplayAt(nextScheduledRetry, "next eligible outbox item");
  }

  return createDrainQueueResult(hadPendingItems);
}
