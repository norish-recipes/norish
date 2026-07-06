import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { ArchiveImportCacheHelpers, ArchiveImportState } from "./types";

const log = createClientLogger("ArchiveImportCache");

const ARCHIVE_IMPORT_KEY = ["archive-import"] as const;

const defaultState: ArchiveImportState = {
  current: 0,
  total: 0,
  imported: 0,
  skipped: 0,
  skippedItems: [],
  isImporting: false,
  errors: [],
};

export function createUseArchiveCache() {
  return function useArchiveImportCacheHelpers(): ArchiveImportCacheHelpers {
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

    return { setImportState, clearImport };
  };
}

export { ARCHIVE_IMPORT_KEY, defaultState };
