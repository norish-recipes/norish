import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { ArchiveImportError, ArchiveSkippedItem } from "@norish/shared/contracts/uploads";
import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export type ArchiveImportState = {
  current: number;
  total: number;
  imported: number;
  skipped: number;
  skippedItems: ArchiveSkippedItem[];
  isImporting: boolean;
  errors: ArchiveImportError[];
};

export type ArchiveImportCacheHelpers = {
  setImportState: (updater: (prev: ArchiveImportState) => ArchiveImportState) => void;
  clearImport: () => void;
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

export type ArchiveImportMutationResult = {
  startImport: (file: File) => void;
  isStarting: boolean;
};

export interface CreateArchiveHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
