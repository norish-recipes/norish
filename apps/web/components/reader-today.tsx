"use client";

import type { ReactNode } from "react";
import { createContext, use } from "react";

import { useToday } from "@norish/shared-react/reader";

const ReaderTodayContext = createContext<string | undefined>(undefined);

/** The reader's date as the server read it from their time zone (lib/reader-today-server.ts). */
export function ReaderTodayProvider({ value, children }: { value?: string; children: ReactNode }) {
  return <ReaderTodayContext value={value}>{children}</ReaderTodayContext>;
}

/**
 * The reader's date, `YYYY-MM-DD`: the server's while the page hydrates, so a seeded range keys
 * the same query, and the browser's own from then on.
 */
export function useReaderToday(): string {
  return useToday(use(ReaderTodayContext));
}
