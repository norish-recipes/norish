"use client";

import type { ArchiveImportError, ArchiveSkippedItem } from "@/types/uploads";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("ArchiveImport");

// Single query key for the active import
const ARCHIVE_IMPORT_KEY = ["archive-import"] as const;

type ArchiveImportState = {
  current: number;
  total: number;
  imported: number;
  skipped: number;
  skippedItems: ArchiveSkippedItem[];
  isImporting: boolean;
  errors: ArchiveImportError[];
};

const defaultState: ArchiveImportState = {
  current: 0,
  total: 0,
  imported: 0,
  skipped: 0,
  skippedItems: [],
  isImporting: false,
  errors: [],
};

export type ArchiveImportQueryResult = {
  current: number;
  total: number;
  imported: number;
  skipped: number;
  skippedItems: ArchiveSkippedItem[];
  isImporting: boolean;
  errors: ArchiveImportError[];
  setImportState: (updater: (prev: ArchiveImportState) => ArchiveImportState) => void;
  clearImport: () => void;
};

/**
 * Hook for accessing archive import state from TanStack Query cache.
 */
export function useArchiveImportQuery(): ArchiveImportQueryResult {
  const queryClient = useQueryClient();

  const { data: state } = useQuery<ArchiveImportState>({
    queryKey: ARCHIVE_IMPORT_KEY,
    queryFn: async () => {
      return defaultState;
    },
    initialData: defaultState, // Creates actual cache entry
    staleTime: Infinity, // Never auto-refetch
    gcTime: Infinity, // Keep in cache forever
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Helper to update import state
  const setImportState = (updater: (prev: ArchiveImportState) => ArchiveImportState) => {
    queryClient.setQueryData<ArchiveImportState>(ARCHIVE_IMPORT_KEY, (prev) => {
      const base = prev ?? defaultState;
      const next = updater(base);

      log.debug({ prev: base, next }, "Archive Import State Update");

      return next;
    });
  };

  // Clear import state
  const clearImport = () => {
    queryClient.setQueryData<ArchiveImportState>(ARCHIVE_IMPORT_KEY, defaultState);
  };

  return {
    current: state?.current ?? 0,
    total: state?.total ?? 0,
    imported: state?.imported ?? 0,
    skipped: state?.skipped ?? 0,
    skippedItems: state?.skippedItems ?? [],
    isImporting: state?.isImporting ?? false,
    errors: state?.errors ?? [],
    setImportState,
    clearImport,
  };
}
