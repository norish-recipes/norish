/**
 * CalDAV Hooks
 *
 * tRPC-based hooks for CalDAV configuration and sync status management.
 * Replaces the old SWR + custom WebSocket pattern.
 */

// Queries
export {
  useCaldavConfigQuery,
  useCaldavPasswordQuery,
  useCaldavSyncStatusQuery,
  useCaldavSummaryQuery,
  useCaldavConnectionQuery,
} from "./use-caldav-query";

export type {
  CaldavConfigQueryResult,
  CaldavSyncStatusQueryResult,
  CaldavSummaryQueryResult,
} from "./use-caldav-query";

// Mutations
export { useCaldavMutations } from "./use-caldav-mutations";

export type {
  SaveCaldavConfigInput,
  TestConnectionInput,
  CaldavMutationsResult,
} from "./use-caldav-mutations";

// Subscriptions
export {
  useCaldavSubscription,
  useCaldavItemStatusSubscription,
  useCaldavSyncCompleteSubscription,
} from "./use-caldav-subscription";

// Cache Helpers
export { useCaldavCacheHelpers, type CaldavCacheHelpers } from "./use-caldav-cache";
