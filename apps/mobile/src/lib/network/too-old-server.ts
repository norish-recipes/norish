import { useSyncExternalStore } from "react";

/** A Server Address a version check found too old, with the version it reported. */
export type TooOldServer = { address: string; version?: string };

// Module scope, so it outlives the re-keys that remount the navigator.
let tooOld: TooOldServer | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** A check answered too old: Update your server shows while this holds. */
export function markServerTooOld(server: TooOldServer): void {
  tooOld = server;
  emit();
}

/** Cleared by a re-check that is new enough, a changed Server Address, or leaving through the chip. */
export function clearServerTooOld(): void {
  if (!tooOld) return;

  tooOld = null;
  emit();
}

export function getTooOldServer(): TooOldServer | null {
  return tooOld;
}

export function useTooOldServer(): TooOldServer | null {
  return useSyncExternalStore(subscribe, () => tooOld);
}
