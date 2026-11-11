/**
 * The one client subscription idiom.
 *
 * `useRealtimeSubscription(procedure, handlers)` subscribes to one realtime
 * procedure and hands every event to a typed `(payload, meta)` handler. The
 * transport's own frames never reach it: the Cursor Mark that opens every
 * subscription is skipped, and `lastEventId` is resent by tRPC's WebSocket
 * link on reconnect without this hook knowing.
 *
 * Every fresh subscription (a mount, `enabled` turning true, the reset after
 * `REALTIME_LAGGED`) carries no cursor, so a change made before the server
 * registered it reaches neither the subscription nor a read taken earlier.
 * The server registers the listener before it sends the first Cursor Mark, so
 * the hook rereads `liveQueryKeys` then. Anything that is neither a Cursor Mark
 * nor an envelope is a programming error.
 */

import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { partialMatchKey, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { RealtimeEventMeta } from "@norish/shared/contracts/realtime/envelope";
import {
  assertEventEnvelope,
  isCursorMark,
  REALTIME_LAGGED,
} from "@norish/shared/contracts/realtime/envelope";

/** The server ended the subscription because it could not continue in order. */
export function isRealtimeLagged(err: unknown): boolean {
  return err instanceof TRPCClientError && err.message === REALTIME_LAGGED;
}

/**
 * A subscription procedure as `useTRPC()` decorates it, reduced to the one
 * call this hook makes. The router's own types satisfy it structurally.
 */
export interface RealtimeSubscriptionProcedure {
  subscriptionOptions(
    input: undefined,
    opts: {
      enabled?: boolean;
      onData: (data: unknown) => void;
      onError: (err: unknown) => void;
    }
  ): unknown;
}

export interface RealtimeSubscriptionHandlers<P> {
  /** Every event of the procedure, validated server-side against its catalogue schema. */
  onEvent: (payload: P, meta: RealtimeEventMeta) => void;
  /** Every read `onEvent` patches or invalidates: reread once each fresh subscription is live. */
  liveQueryKeys?: QueryKey[];
  enabled?: boolean;
}

/**
 * What tRPC hands `onData` for a `tracked()` subscription: the cursor beside
 * the item. The link keeps the id; the item is what the server yielded.
 */
interface TrackedItem {
  id: string;
  data: unknown;
}

function isTrackedItem(data: unknown): data is TrackedItem {
  return (
    data !== null &&
    typeof data === "object" &&
    typeof (data as { id?: unknown }).id === "string" &&
    "data" in data
  );
}

/** Per QueryClient: the reads due in the current window. */
const dueByClient = new WeakMap<QueryClient, QueryKey[]>();

/**
 * Reads due within one window are invalidated together, so each matching query refetches once.
 * ponytail: a fixed 50 ms window, so marks spread wider refetch once per window; flush once
 * every open subscribe has its mark if that shows up as duplicate refetches.
 */
const LIVE_WINDOW_MS = 50;

function rereadInWindow(queryClient: QueryClient, queryKeys: QueryKey[]): void {
  const due = dueByClient.get(queryClient);

  if (queryKeys.length === 0) return;
  if (due) {
    due.push(...queryKeys);

    return;
  }
  dueByClient.set(queryClient, [...queryKeys]);
  setTimeout(() => {
    const flushed = dueByClient.get(queryClient) ?? [];

    dueByClient.delete(queryClient);
    const isDue = (query: Query) => flushed.some((key) => partialMatchKey(query.queryKey, key));
    const inFlight = queryClient
      .getQueryCache()
      .findAll({ predicate: isDue, fetchStatus: "fetching" });

    // A fetch in flight may predate go-live, and its success clears an invalidation made now:
    // each waits for its own, so one that never settles (paused offline) holds back no other.
    for (const query of inFlight) {
      const reread = () =>
        void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });

      void query.promise?.then(reread, reread);
    }
    void queryClient.invalidateQueries({
      predicate: (query) => isDue(query) && query.state.fetchStatus !== "fetching",
    });
  }, LIVE_WINDOW_MS);
}

/**
 * A fresh subscription's reread: armed by its subscribe, taken by its first Cursor Mark.
 * Not a ref: the React Compiler skips a hook that reads one in callbacks `subscriptionOptions` gets.
 */
function createLiveLatch() {
  let pending = false;

  return {
    arm: () => {
      pending = true;
    },
    take: () => {
      const wasPending = pending;

      pending = false;

      return wasPending;
    },
  };
}

export function useRealtimeSubscription<P>(
  procedure: RealtimeSubscriptionProcedure,
  handlers: RealtimeSubscriptionHandlers<P>
) {
  const queryClient = useQueryClient();
  const [liveLatch] = useState(createLiveLatch);

  // tRPC reads `"enabled" in opts`, not its value: a key that is present but
  // undefined disables the subscription. Only a stated choice is passed on.
  const options = procedure.subscriptionOptions(undefined, {
    ...(handlers.enabled === undefined ? {} : { enabled: handlers.enabled }),
    onData: (data) => {
      if (!isTrackedItem(data)) {
        throw new TypeError("Expected a tracked realtime item");
      }

      const item = data.data;

      // A Cursor Mark carries no event: the transport tracks it, handlers never
      // see it. It does say the subscription is live, which the reread waits for.
      if (isCursorMark(item)) {
        if (liveLatch.take()) rereadInWindow(queryClient, handlers.liveQueryKeys ?? []);

        return;
      }

      assertEventEnvelope<P>(item);
      handlers.onEvent(item.payload, item.meta);
    },
    onError: (err) => {
      if (!isRealtimeLagged(err)) return;

      // A fresh subscription, no cursor; the reread follows its Cursor Mark.
      subscription.reset();
    },
  }) as Parameters<typeof useSubscription>[0];

  // The one cast of the idiom, above: `subscriptionOptions` is typed by the router's
  // output, which the structural procedure type deliberately leaves open.
  const subscription = useSubscription({
    ...options,
    // A reconnect resends on the same subscribe; only a new subscribe is fresh.
    subscribe: (observer) => {
      liveLatch.arm();

      return options.subscribe(observer);
    },
  });

  return subscription;
}
