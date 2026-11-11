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
 * Its first Cursor Mark closes that gap: the server registers the listener
 * before it sends the mark, so the hook refetches the domain then (`onCatchUp`,
 * or invalidate `catchUpQueryKeys`) and every event after it reaches the
 * subscription. A reconnect resends the cursor on the same subscribe and
 * Resume replays what it missed, so its mark refetches nothing. Anything that
 * is neither a Cursor Mark nor an envelope is a programming error.
 */

import type { QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { hashKey, useQueryClient } from "@tanstack/react-query";
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
  /** Invalidated once each fresh subscription is live, unless `onCatchUp` takes over. */
  catchUpQueryKeys?: QueryKey[];
  onCatchUp?: () => void;
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

/**
 * A fresh subscription's catch-up: armed by its subscribe, taken by its first Cursor Mark.
 * Not a ref: the React Compiler skips a hook that reads one in callbacks `subscriptionOptions` gets.
 */
function createCatchUpLatch() {
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

/**
 * Catch-ups due, by what they refetch: subscriptions that go live together share one refetch.
 * ponytail: a fixed window; marks spread wider refetch once per window, never before their mark.
 */
const dueCatchUps = new Map<unknown, () => void>();
const CATCH_UP_WINDOW_MS = 50;

function runDueCatchUps(): void {
  const due = [...dueCatchUps.values()];

  dueCatchUps.clear();
  for (const run of due) run();
}

function scheduleCatchUp(key: unknown, run: () => void): void {
  if (dueCatchUps.size === 0) setTimeout(runDueCatchUps, CATCH_UP_WINDOW_MS);
  dueCatchUps.set(key, run);
}

export function useRealtimeSubscription<P>(
  procedure: RealtimeSubscriptionProcedure,
  handlers: RealtimeSubscriptionHandlers<P>
) {
  const queryClient = useQueryClient();
  const [catchUpLatch] = useState(createCatchUpLatch);

  const catchUp = () => {
    const { onCatchUp } = handlers;

    if (onCatchUp) {
      scheduleCatchUp(onCatchUp, onCatchUp);

      return;
    }

    for (const queryKey of handlers.catchUpQueryKeys ?? []) {
      scheduleCatchUp(hashKey(queryKey), () => void queryClient.invalidateQueries({ queryKey }));
    }
  };

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
      // see it. It does say the subscription is live, which a catch-up waits for.
      if (isCursorMark(item)) {
        if (catchUpLatch.take()) catchUp();

        return;
      }

      assertEventEnvelope<P>(item);
      handlers.onEvent(item.payload, item.meta);
    },
    onError: (err) => {
      if (!isRealtimeLagged(err)) return;

      // A fresh subscription, no cursor; the refetch follows its Cursor Mark.
      subscription.reset();
    },
  });

  // The one cast of the idiom: `subscriptionOptions` is typed by the router's
  // output, which the structural procedure type above deliberately leaves open.
  const tracked = options as Parameters<typeof useSubscription>[0];
  const subscription = useSubscription({
    ...tracked,
    // A reconnect resends on the same subscribe; only a new subscribe is fresh.
    subscribe: (observer) => {
      catchUpLatch.arm();

      return tracked.subscribe(observer);
    },
  });

  return subscription;
}
