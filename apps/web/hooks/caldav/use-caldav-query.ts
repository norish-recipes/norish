"use client";

import { sharedCaldavHooks } from "./shared-caldav-hooks";

export const useCaldavConfigQuery = sharedCaldavHooks.useCaldavConfigQuery;
export const useCaldavPasswordQuery = sharedCaldavHooks.useCaldavPasswordQuery;
export const useCaldavSyncStatusQuery = sharedCaldavHooks.useCaldavSyncStatusQuery;
export const useCaldavSummaryQuery = sharedCaldavHooks.useCaldavSummaryQuery;
export const useCaldavConnectionQuery = sharedCaldavHooks.useCaldavConnectionQuery;

export type {
  CaldavConfigQueryResult,
  CaldavSummaryQueryResult,
  CaldavSyncStatusQueryResult,
} from "@norish/shared-react/hooks";
