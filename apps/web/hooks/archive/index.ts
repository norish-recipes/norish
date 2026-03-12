"use client";

import { sharedArchiveHooks } from "./shared-archive-hooks";

export const useArchiveImportQuery = sharedArchiveHooks.useArchiveImportQuery;
export const useArchiveImportMutation = sharedArchiveHooks.useArchiveImportMutation;
export const useArchiveImportSubscription = sharedArchiveHooks.useArchiveImportSubscription;

export type {
  ArchiveImportQueryResult,
  ArchiveImportMutationResult,
} from "@norish/shared-react/hooks";
