"use client";

/**
 * Lightweight cache manipulation helpers for archive import.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in subscription hooks to avoid
 * duplicate hook trees that cause recursion issues.
 *
 * For reading data + cache manipulation, use useArchiveImportQuery instead.
 */

import type { ArchiveImportError, ArchiveSkippedItem } from "@/types/uploads";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("ArchiveImportCache");

// Local-only cache key for archive import progress (not a tRPC query)
const ARCHIVE_IMPORT_KEY = ["archive-import"] as const;

export type ArchiveImportState = {
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

export type ArchiveImportCacheHelpers = {
  setImportState: (updater: (prev: ArchiveImportState) => ArchiveImportState) => void;
  clearImport: () => void;
};

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 */
export function useArchiveImportCacheHelpers(): ArchiveImportCacheHelpers {
  const queryClient = useQueryClient();

  const setImportState = useCallback(
    (updater: (prev: ArchiveImportState) => ArchiveImportState) => {
      queryClient.setQueryData<ArchiveImportState>(ARCHIVE_IMPORT_KEY, (prev) => {
        const base = prev ?? defaultState;
        const next = updater(base);

        log.debug({ prev: base, next }, "Archive Import State Update");

        return next;
      });
    },
    [queryClient]
  );

  const clearImport = useCallback(() => {
    queryClient.setQueryData<ArchiveImportState>(ARCHIVE_IMPORT_KEY, defaultState);
  }, [queryClient]);

  return {
    setImportState,
    clearImport,
  };
}

// Export the key for use in the query hook (needs to match)
export { ARCHIVE_IMPORT_KEY };
