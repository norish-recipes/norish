"use client";

import type { ReactNode } from "react";
import { createContext, use, useSyncExternalStore } from "react";

import { dateKey } from "@norish/shared/lib/helpers";

const ReaderTodayContext = createContext<string | undefined>(undefined);

/** The reader's date as the server read it from their time zone (lib/reader-today-server.ts). */
export function ReaderTodayProvider({ value, children }: { value?: string; children: ReactNode }) {
  return <ReaderTodayContext value={value}>{children}</ReaderTodayContext>;
}

// The day turns over under a page left open; once a minute is soon enough to notice.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);

  return () => clearInterval(id);
}

/**
 * The reader's date, `YYYY-MM-DD`: the server's while the page hydrates, so a seeded range keys
 * the same query, and the browser's own from then on.
 */
export function useReaderToday(): string {
  const serverToday = use(ReaderTodayContext);

  return useSyncExternalStore(
    subscribe,
    () => dateKey(new Date()),
    () => serverToday ?? dateKey(new Date())
  );
}
