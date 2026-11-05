/**
 * The web client's offline engine (ADR-0001): the shared engine over the IndexedDB adapter,
 * plus what only web has — the server-rendered first frame (QuerySeed) and the image cache.
 */

import type { DehydratedState, Query, QueryClient } from "@tanstack/react-query";
import { getInitialDateRange } from "@/app/(app)/calendar/context-helpers";
import { HEALTH_PROBE_URL } from "@/lib/connectivity/probe";
import { createIdbStorage } from "@/lib/offline/idb-storage";
import { warmPrimaryImages } from "@/lib/offline/warm-images";

import type {
  CalendarRange,
  LockManagerLike,
  OfflineEngine,
  OfflineStorage,
} from "@norish/shared-react/offline";
import {
  createOfflineEngine,
  createOfflineQueryClient,
  QUERY_STALE_TIME_MS,
} from "@norish/shared-react/offline";
import { dateKey } from "@norish/shared/lib/helpers";

/** Marks the web client's replays in server logs. */
export const OUTBOX_REPLAY_HEADER_VALUE = "web-outbox";

/**
 * Cache buster — a restored cache from a different app version is dropped
 * wholesale rather than migrated, so a schema change can never surface stale
 * shapes. Human intent in the Outbox is busted separately (never here).
 */
// NEXT_PUBLIC values are intentionally exposed to the browser by Next.js.
// eslint-disable-next-line no-restricted-properties
export const CACHE_BUSTER = process.env.NEXT_PUBLIC_APP_VERSION;

/** The data each query held as the server sent it with this page load, by query hash. */
const serverCopies = new Map<string, unknown>();

/**
 * Note the reads the server sent with the page (QuerySeed). Browser only: on the server this
 * module outlives a request.
 */
export function markServerCopies(state: DehydratedState | undefined): void {
  if (typeof window === "undefined") return;

  for (const { queryHash, state: query } of state?.queries ?? []) {
    serverCopies.set(queryHash, query.data);
  }
}

/**
 * A server copy, unchanged and under the stale time (a document the worker kept can be old), is
 * current. Every other copy refetches on mount: a restored one may predate a change made elsewhere.
 */
const refetchOnMount = (query: Query) =>
  // Never on the server: a seeded query marked as refetching renders a spinner there, which the
  // hydrating render does not.
  typeof window === "undefined" ||
  (serverCopies.has(query.queryHash) &&
    serverCopies.get(query.queryHash) === query.state.data &&
    !query.isStaleByTime(QUERY_STALE_TIME_MS))
    ? false
    : ("always" as const);

function calendarRanges(): CalendarRange[] {
  return (["desktop", "mobile"] as const).map((mode) => {
    const { start, end } = getInitialDateRange(mode);

    return { startISO: dateKey(start), endISO: dateKey(end) };
  });
}

function browserLocks(): LockManagerLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return (navigator as Navigator & { locks?: LockManagerLike }).locks ?? null;
}

/** Tests build their own over `fake-indexeddb`; the app shares {@link offlineEngine}. */
export function createWebOfflineEngine(
  storage: OfflineStorage = createIdbStorage()
): OfflineEngine {
  return createOfflineEngine({
    storage,
    replayHeaderValue: OUTBOX_REPLAY_HEADER_VALUE,
    probeUrl: () => HEALTH_PROBE_URL,
    buster: CACHE_BUSTER,
    locks: browserLocks,
    calendarRanges,
    warmImages: warmPrimaryImages,
    refetchOnMount,
    onClear: () => serverCopies.clear(),
  });
}

export const offlineEngine = createWebOfflineEngine();
export const cacheManager = offlineEngine.cache;
export const outboxStore = offlineEngine.outbox;

/** The seam handed to the provider bundle's `getQueryClient`. */
export function getPersistedQueryClient(): QueryClient {
  // The engine's client is the browser's. Each server render gets its own, or a page the server
  // seeded with one reader's data would leave it for the next request.
  return typeof window === "undefined"
    ? createOfflineQueryClient({ refetchOnMount })
    : offlineEngine.queryClient;
}
