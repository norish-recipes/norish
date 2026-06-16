import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { ArchiveImportQueryResult, ArchiveImportState } from "./types";
import { ARCHIVE_IMPORT_KEY, defaultState } from "./use-archive-cache";

const log = createClientLogger("ArchiveImport");

export function createUseArchiveQuery() {
  return function useArchiveImportQuery(): ArchiveImportQueryResult {
    const queryClient = useQueryClient();

    const { data: state } = useQuery<ArchiveImportState>({
      queryKey: ARCHIVE_IMPORT_KEY,
      queryFn: async () => {
        return defaultState;
      },
      initialData: defaultState,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });

    const setImportState = (updater: (prev: ArchiveImportState) => ArchiveImportState) => {
      queryClient.setQueryData<ArchiveImportState>(ARCHIVE_IMPORT_KEY, (prev) => {
        const base = prev ?? defaultState;
        const next = updater(base);

        log.debug({ prev: base, next }, "Archive Import State Update");

        return next;
      });
    };

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
  };
}
