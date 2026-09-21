/**
 * The one client subscription idiom.
 *
 * `useRealtimeSubscription(procedure, handlers)` subscribes to one realtime
 * procedure and hands every event to a typed `(payload, meta)` handler. The
 * transport's own frames never reach it: the Cursor Mark that opens every
 * subscription is skipped, and `lastEventId` is resent by tRPC's WebSocket
 * link on reconnect without this hook knowing.
 *
 * One reaction to a subscription that fell out of order (`REALTIME_LAGGED`):
 * refetch the domain — `onLag`, or invalidate `lagQueryKeys` — and start a
 * fresh subscription with no cursor. Anything that is neither a Cursor Mark
 * nor an envelope is a programming error, not a case to tolerate.
 */

import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
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
  /** Invalidated when the subscription lags, unless `onLag` takes over. */
  lagQueryKeys?: QueryKey[];
  onLag?: () => void;
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

export function useRealtimeSubscription<P>(
  procedure: RealtimeSubscriptionProcedure,
  handlers: RealtimeSubscriptionHandlers<P>
) {
  const queryClient = useQueryClient();

  // tRPC reads `"enabled" in opts`, not its value: a key that is present but
  // undefined disables the subscription. Only a stated choice is passed on.
  const options = procedure.subscriptionOptions(undefined, {
    ...(handlers.enabled === undefined ? {} : { enabled: handlers.enabled }),
    onData: (data) => {
      if (!isTrackedItem(data)) {
        throw new TypeError("Expected a tracked realtime item");
      }

      const item = data.data;

      // A Cursor Mark carries no event: the transport tracks it, handlers never see it.
      if (isCursorMark(item)) return;

      assertEventEnvelope<P>(item);
      handlers.onEvent(item.payload, item.meta);
    },
    onError: (err) => {
      if (!isRealtimeLagged(err)) return;

      if (handlers.onLag) {
        handlers.onLag();
      } else {
        for (const queryKey of handlers.lagQueryKeys ?? []) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }

      // A fresh subscription, no cursor: the refetch above is the catch-up.
      subscription.reset();
    },
  });

  // The one cast of the idiom: `subscriptionOptions` is typed by the router's
  // output, which the structural procedure type above deliberately leaves open.
  const subscription = useSubscription(options as Parameters<typeof useSubscription>[0]);

  return subscription;
}
