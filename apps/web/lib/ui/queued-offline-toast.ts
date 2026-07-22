"use client";

import { toast } from "@heroui/react";

import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

/**
 * Whether a failed mutation was in fact Queued (design record: "Queued is a
 * third outcome"): on the backend-unreachable signal the Outbox link has
 * captured the mutation for Replay — admission is universal — so the change is
 * saved, not lost. Callers must present this as "saved offline", never as an
 * error. This is the same signal the hero hooks use to keep their optimistic
 * state (`shouldPreserveOptimisticUpdate`).
 */
export function isQueuedForReplay(error: unknown): boolean {
  return isBackendUnreachableError(error);
}

export interface QueuedOfflineToastStrings {
  title: string;
  description: string;
}

/**
 * The Queued-outcome toast: offline-warning styled with reassuring copy — the
 * change is in the Outbox and runs on reconnect. Callers pass the translated
 * `common.queuedOffline` strings.
 */
export function showQueuedOfflineToast({ title, description }: QueuedOfflineToastStrings): void {
  toast(title, { description, variant: "warning" });
}
