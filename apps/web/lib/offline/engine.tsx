"use client";

// The web client's offline wiring (ADR-0001): the shared engine over IndexedDB, its connectivity
// hints and controller, plus what only web has: the QuerySeed first frame and the image cache.
import type {
  DehydratedState,
  Query,
  QueryCacheNotifyEvent,
  QueryClient,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { useUserContext } from "@/context/user-context";
import { isOfflineForced, subscribeOfflineForced } from "@/lib/connectivity/forced-offline";
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
  HEALTH_PROBE_PATH,
  QUERY_STALE_TIME_MS,
} from "@norish/shared-react/offline";
import {
  OfflineController,
  ConnectivityProvider as SharedConnectivityProvider,
  useConnectivity,
} from "@norish/shared-react/offline/react";
import { isKeptCurrent } from "@norish/shared-react/realtime";
import { useConnectionStatus, useTRPC, useTRPCClient } from "@norish/shared-react/trpc";
import { getSession } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";
import { dateKey, getInitialDateRange } from "@norish/shared/lib/helpers";
import { APP_VERSION } from "@norish/web/config/site";

/** Marks the web client's replays in server logs. */
export const OUTBOX_REPLAY_HEADER_VALUE = "web-outbox";

/** The readiness route under the web client's base path. */
const HEALTH_PROBE_URL = addBasePath(HEALTH_PROBE_PATH);

/** A restored cache from another app version is dropped, never migrated; the Outbox is kept. */
export const CACHE_BUSTER = APP_VERSION;

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

/** The queries the server has answered since this page loaded: a read, or the seed it arrived with. */
const answered = new WeakSet<Query>();

function noteAnswer({ query, ...event }: QueryCacheNotifyEvent): void {
  const read = event.type === "updated" && event.action.type === "success" && !event.action.manual;
  const seeded =
    query.state.data !== undefined && serverCopies.get(query.queryHash) === query.state.data;

  if (read || seeded) answered.add(query);
}

/**
 * The server's unchanged copy under the stale time is current, and until stale so is one it answered
 * that a mounted subscription keeps current. Any other may predate a change made elsewhere.
 */
const refetchOnMount = (query: Query) => {
  // Never on the server: a seeded query marked as refetching renders a spinner there, which the
  // hydrating render does not.
  if (typeof window === "undefined") return false;
  if (
    serverCopies.has(query.queryHash) &&
    serverCopies.get(query.queryHash) === query.state.data &&
    !query.isStaleByTime(QUERY_STALE_TIME_MS)
  ) {
    return false;
  }

  return answered.has(query) && isKeptCurrent(query.queryKey) ? true : ("always" as const);
};

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
  const engine = createOfflineEngine({
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

  engine.queryClient.getQueryCache().subscribe(noteAnswer);

  return engine;
}

export const offlineEngine = createWebOfflineEngine();

/** The seam handed to the provider bundle's `getQueryClient`. */
export function getPersistedQueryClient(): QueryClient {
  // The engine's client is the browser's. Each server render gets its own, or a page the server
  // seeded with one reader's data would leave it for the next request.
  return typeof window === "undefined"
    ? createOfflineQueryClient({ refetchOnMount })
    : offlineEngine.queryClient;
}

const probe = () => offlineEngine.probe();
const serverForcedSnapshot = () => false;

// Browser connectivity is only a hint, never the verdict: it just brings the next probe forward.
function subscribeBrowserHints(probeNow: () => void): () => void {
  window.addEventListener("online", probeNow);
  window.addEventListener("offline", probeNow);

  return () => {
    window.removeEventListener("online", probeNow);
    window.removeEventListener("offline", probeNow);
  };
}

/** The shared probe loop with `navigator.onLine` as a hint, plus the dev forced Offline (ADR-0007). */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const { status: wsStatus } = useConnectionStatus();

  // Always false in production, where subscribeOfflineForced is a no-op.
  const forced = useSyncExternalStore(
    subscribeOfflineForced,
    isOfflineForced,
    serverForcedSnapshot
  );

  return (
    <SharedConnectivityProvider
      forced={forced}
      probe={probe}
      subscribeHints={subscribeBrowserHints}
      wsStatus={wsStatus}
    >
      {children}
    </SharedConnectivityProvider>
  );
}

const getSessionUserId = () => getSession().then((session) => session?.data?.user?.id ?? null);

/** The shared offline controller over the web engine, below `UserProvider`. */
export function OfflineCacheController({
  children,
  seededUserId,
}: {
  children: ReactNode;
  /** The reader the layout's server pass verified; absent offline. */
  seededUserId?: string;
}) {
  const { user } = useUserContext();
  const connectivity = useConnectivity();
  const { status: wsStatus } = useConnectionStatus();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();

  // The server's verified id stands in until the browser's own session request
  // answers, so the cache restores at hydration rather than a round trip later.
  return (
    <OfflineController
      connectivity={connectivity}
      engine={offlineEngine}
      getSessionUserId={getSessionUserId}
      sessionUserId={user?.id ?? seededUserId ?? null}
      transport={trpcClient}
      trpc={trpc}
      wsStatus={wsStatus}
    >
      {children}
    </OfflineController>
  );
}
