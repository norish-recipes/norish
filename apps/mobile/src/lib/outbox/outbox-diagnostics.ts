import { createClientLogger } from "@norish/shared/lib/logger";

import { isProcessing } from "./outbox-replay";
import * as outboxStore from "./outbox-store";

const log = createClientLogger("outbox-diagnostics");

export type OutboxDiagnostics = {
  /** Number of items currently in the outbox. */
  queueLength: number;
  /** Whether the replay coordinator is currently processing. */
  isReplaying: boolean;
  /** Oldest item timestamp (ISO-8601) or null if queue is empty. */
  oldestItemAt: string | null;
  /** Summary of items by procedure path. */
  byPath: Record<string, number>;
};

/**
 * Capture a snapshot of outbox state for debugging purposes.
 * This is intentionally cheap to call and does not trigger any processing.
 */
export function getOutboxDiagnostics(): OutboxDiagnostics {
  const items = outboxStore.loadAll();

  const byPath: Record<string, number> = {};

  for (const item of items) {
    byPath[item.path] = (byPath[item.path] ?? 0) + 1;
  }

  return {
    queueLength: items.length,
    isReplaying: isProcessing(),
    oldestItemAt: items.length > 0 ? items[0].createdAt : null,
    byPath,
  };
}

/**
 * Log the current outbox diagnostics.
 * Useful for periodic health checks or debugging.
 */
export function logOutboxDiagnostics(): void {
  const diagnostics = getOutboxDiagnostics();

  if (diagnostics.queueLength === 0) {
    log.debug({}, "Outbox empty");

    return;
  }

  log.debug(
    `Outbox: ${diagnostics.queueLength} item(s), replaying=${diagnostics.isReplaying}, oldest=${diagnostics.oldestItemAt}`
  );
}
