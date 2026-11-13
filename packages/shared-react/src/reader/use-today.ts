"use client";

import { useSyncExternalStore } from "react";

import { dateKey } from "@norish/shared/lib/helpers";

// The day turns over under a screen left open; once a minute is soon enough to notice.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);

  return () => clearInterval(id);
}

/**
 * The reader's date, `YYYY-MM-DD`, following the device's clock. `serverToday` is the date the
 * server rendered for the reader's time zone: it is what a hydrating page shows first, so a seeded
 * range keys the same query.
 */
export function useToday(serverToday?: string): string {
  return useSyncExternalStore(
    subscribe,
    () => dateKey(new Date()),
    () => serverToday ?? dateKey(new Date())
  );
}
