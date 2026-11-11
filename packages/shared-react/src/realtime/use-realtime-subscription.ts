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
 * the hook rereads `liveQueryKeys` then, except a key that a live copy of the
 * same procedure already kept current. Anything that is neither a Cursor Mark
 * nor an envelope is a programming error.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { hashKey, partialMatchKey, useQueryClient } from "@tanstack/react-query";
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

/** One subscribe, from its call until it unsubscribes or fails; `live` from its first Cursor Mark. */
interface Subscribed {
  procedure: string;
  order: number;
  afterLag: boolean;
  live?: { order: number; queryKeys: QueryKey[] };
}

/** Per QueryClient: the open subscribes, and the reads due in the current window. */
interface ClientRealtime {
  order: number;
  open: Set<Subscribed>;
  due: QueryKey[];
}

const realtimeByClient = new WeakMap<QueryClient, ClientRealtime>();

function realtimeOf(queryClient: QueryClient): ClientRealtime {
  let realtime = realtimeByClient.get(queryClient);

  if (!realtime) {
    realtime = { order: 0, open: new Set(), due: [] };
    realtimeByClient.set(queryClient, realtime);
  }

  return realtime;
}

/** Whether a subscribe of the same procedure, live before `own` subscribed, keeps `queryKey` current. */
function isKeptByLiveCopy(realtime: ClientRealtime, own: Subscribed, queryKey: QueryKey): boolean {
  return [...realtime.open].some(
    ({ procedure, live }) =>
      procedure === own.procedure &&
      live !== undefined &&
      live.order < own.order &&
      live.queryKeys.some((kept) => partialMatchKey(queryKey, kept))
  );
}

/**
 * Reads due within one window are invalidated together, so each matching query refetches once.
 * ponytail: a fixed 50 ms window; marks spread wider refetch once per window. Flush once every
 * open subscribe has its mark if spread marks show up as duplicate refetches.
 */
const LIVE_WINDOW_MS = 50;

function rereadInWindow(queryClient: QueryClient, queryKeys: QueryKey[]): void {
  const realtime = realtimeOf(queryClient);

  if (queryKeys.length === 0) return;
  if (realtime.due.length === 0) {
    setTimeout(() => {
      const due = realtime.due;

      realtime.due = [];
      void queryClient.invalidateQueries({
        predicate: (query) => due.some((queryKey) => partialMatchKey(query.queryKey, queryKey)),
      });
    }, LIVE_WINDOW_MS);
  }
  realtime.due.push(...queryKeys);
}

/**
 * The hook's current subscribe. Not a ref: the React Compiler skips a hook that reads one in
 * callbacks `subscriptionOptions` gets.
 */
function createSubscribes() {
  let current: Subscribed | undefined;
  let lagged = false;

  return {
    open: (realtime: ClientRealtime, procedure: string): Subscribed => {
      current = { procedure, order: ++realtime.order, afterLag: lagged };
      lagged = false;
      realtime.open.add(current);

      return current;
    },
    /** On the first Cursor Mark only: the keys to reread, less any a live copy kept current. */
    goLive: (realtime: ClientRealtime, queryKeys: QueryKey[]): QueryKey[] => {
      const own = current;

      if (!own || own.live) return [];
      own.live = { order: ++realtime.order, queryKeys };

      // A lag may have dropped events on every copy, so it vouches for nothing.
      return own.afterLag
        ? queryKeys
        : queryKeys.filter((queryKey) => !isKeptByLiveCopy(realtime, own, queryKey));
    },
    fail: (realtime: ClientRealtime, lag: boolean) => {
      if (current) realtime.open.delete(current);
      lagged = lag;
    },
  };
}

export function useRealtimeSubscription<P>(
  procedure: RealtimeSubscriptionProcedure,
  handlers: RealtimeSubscriptionHandlers<P>
) {
  const queryClient = useQueryClient();
  const [subscribes] = useState(createSubscribes);

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
        const realtime = realtimeOf(queryClient);

        rereadInWindow(queryClient, subscribes.goLive(realtime, handlers.liveQueryKeys ?? []));

        return;
      }

      assertEventEnvelope<P>(item);
      handlers.onEvent(item.payload, item.meta);
    },
    onError: (err) => {
      const lag = isRealtimeLagged(err);

      // A failed subscription keeps nothing current.
      subscribes.fail(realtimeOf(queryClient), lag);
      if (!lag) return;

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
      const realtime = realtimeOf(queryClient);
      const own = subscribes.open(realtime, hashKey(options.queryKey));
      const inner = options.subscribe(observer);

      return {
        unsubscribe: () => {
          realtime.open.delete(own);
          inner.unsubscribe();
        },
      };
    },
  });

  return subscription;
}
