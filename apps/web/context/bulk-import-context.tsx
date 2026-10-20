"use client";

import type { BulkImportTrackerItem } from "@/context/bulk-import-state";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { isBulkImportSettled } from "@/components/import/bulk-image-import-state";
import {
  activeBulkImportCount,
  bulkImportTrackerReducer,
  clearStoredBulkImportTracker,
  EMPTY_BULK_IMPORT_TRACKER,
  readStoredBulkImportTracker,
  writeStoredBulkImportTracker,
} from "@/context/bulk-import-state";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export interface BulkImportContextValue {
  activeCount: number;
  items: BulkImportTrackerItem[];
  trackBatch: (batchId: string, files: readonly File[]) => void;
  clearBatch: () => void;
  retry: (items: readonly BulkImportTrackerItem[]) => void;
}

const BulkImportContext = createContext<BulkImportContextValue | null>(null);

export function BulkImportProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("recipes.bulkImport");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(bulkImportTrackerReducer, EMPTY_BULK_IMPORT_TRACKER);
  const previewsRef = useRef(new Map<number, string>());
  const handledDoneRef = useRef(new Set<string>());
  const libraryPathKey = useMemo(() => trpc.library.list.pathKey(), [trpc]);

  const resetTracker = useCallback(() => {
    for (const preview of previewsRef.current.values()) {
      URL.revokeObjectURL(preview);
    }

    previewsRef.current.clear();
    handledDoneRef.current.clear();
    clearStoredBulkImportTracker();
    dispatch({ type: "cleared" });
  }, []);

  useEffect(() => {
    dispatch({ type: "restored", state: readStoredBulkImportTracker() });
  }, []);

  useEffect(() => {
    if (!state.restored) return;

    writeStoredBulkImportTracker(state);
  }, [state]);

  useEffect(() => {
    const previews = previewsRef.current;

    return () => {
      for (const preview of previews.values()) {
        URL.revokeObjectURL(preview);
      }

      previews.clear();
    };
  }, []);

  const statusQuery = useQuery({
    ...trpc.recipes.imageImportBatchStatus.queryOptions({ batchId: state.batchId ?? "" }),
    enabled: state.batchId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;

      return data && !isBulkImportSettled(data) ? 2000 : false;
    },
  });

  useEffect(() => {
    const batch = statusQuery.data;

    if (!batch) return;

    let newlyDone = false;

    for (const item of batch.items) {
      if (item.status !== "done") continue;

      if (!handledDoneRef.current.has(item.itemId)) {
        newlyDone = true;
      }

      handledDoneRef.current.add(item.itemId);

      const preview = previewsRef.current.get(item.position);

      if (preview) {
        URL.revokeObjectURL(preview);
        previewsRef.current.delete(item.position);
      }
    }

    if (newlyDone) {
      void queryClient.invalidateQueries({ queryKey: libraryPathKey });
    }

    if (isBulkImportSettled(batch) && !batch.items.some((item) => item.retryable)) {
      resetTracker();

      return;
    }

    dispatch({ type: "batch-updated", batch });
  }, [libraryPathKey, queryClient, resetTracker, statusQuery.data]);

  useEffect(() => {
    if (!state.batchId || !statusQuery.isSuccess || statusQuery.data !== null) return;

    resetTracker();
  }, [resetTracker, state.batchId, statusQuery.data, statusQuery.isSuccess]);

  const retryMutation = useMutation(
    trpc.recipes.retryImageBatchItems.mutationOptions({
      onSuccess: (batch) => {
        queryClient.setQueryData(
          trpc.recipes.imageImportBatchStatus.queryKey({ batchId: batch.batchId }),
          batch
        );
        dispatch({ type: "batch-updated", batch });
      },
      onError: (error) => {
        showSafeErrorToast({
          title: t("retryFailed"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "bulk-image-import:retry",
        });
      },
    })
  );

  const trackBatch = useCallback((batchId: string, files: readonly File[]) => {
    for (const preview of previewsRef.current.values()) {
      URL.revokeObjectURL(preview);
    }

    previewsRef.current.clear();
    handledDoneRef.current.clear();

    const previewUrls = files.map((file, position) => {
      const previewUrl = URL.createObjectURL(file);

      previewsRef.current.set(position, previewUrl);

      return previewUrl;
    });

    dispatch({
      type: "tracked",
      batchId,
      filenames: files.map((file) => file.name),
      previewUrls,
    });
  }, []);

  const retry = useCallback(
    (targets: readonly BulkImportTrackerItem[]) => {
      if (!state.batchId || targets.length === 0) return;

      retryMutation.mutate({
        batchId: state.batchId,
        itemIds: targets.map((item) => item.itemId),
      });
    },
    [retryMutation, state.batchId]
  );

  const value = useMemo<BulkImportContextValue>(
    () => ({
      activeCount: activeBulkImportCount(state.items),
      items: state.items,
      trackBatch,
      clearBatch: resetTracker,
      retry,
    }),
    [resetTracker, retry, state.items, trackBatch]
  );

  return <BulkImportContext.Provider value={value}>{children}</BulkImportContext.Provider>;
}

export function useBulkImport(): BulkImportContextValue {
  const context = useContext(BulkImportContext);

  if (!context) {
    throw new Error("useBulkImport must be used within BulkImportProvider");
  }

  return context;
}
