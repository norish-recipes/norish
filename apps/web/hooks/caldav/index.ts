"use client";

/**
 * CalDAV Hooks
 *
 * tRPC-based hooks for CalDAV configuration and sync status management.
 */
import { sharedCaldavHooks } from "./shared-caldav-hooks";

// Queries
export const useCaldavConfigQuery = sharedCaldavHooks.useCaldavConfigQuery;
export const useCaldavPasswordQuery = sharedCaldavHooks.useCaldavPasswordQuery;
export const useCaldavSyncStatusQuery = sharedCaldavHooks.useCaldavSyncStatusQuery;
export const useCaldavSummaryQuery = sharedCaldavHooks.useCaldavSummaryQuery;
export const useCaldavConnectionQuery = sharedCaldavHooks.useCaldavConnectionQuery;
export type {
  CaldavConfigQueryResult,
  CaldavSyncStatusQueryResult,
  CaldavSummaryQueryResult,
} from "@norish/shared-react/hooks";

// Mutations
export const useCaldavMutations = sharedCaldavHooks.useCaldavMutations;
export type {
  SaveCaldavConfigInput,
  TestConnectionInput,
  CaldavMutationsResult,
} from "@norish/shared-react/hooks";

// Subscriptions
export const useCaldavSubscription = sharedCaldavHooks.useCaldavSubscription;
export const useCaldavItemStatusSubscription = sharedCaldavHooks.useCaldavItemStatusSubscription;
export const useCaldavSyncCompleteSubscription =
  sharedCaldavHooks.useCaldavSyncCompleteSubscription;

// Cache Helpers
export const useCaldavCacheHelpers = sharedCaldavHooks.useCaldavCacheHelpers;
export type { CaldavCacheHelpers } from "@norish/shared-react/hooks";
