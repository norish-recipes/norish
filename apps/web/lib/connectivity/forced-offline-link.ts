import type { TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import type { Unsubscribable } from "@trpc/server/observable";
import { TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";

import { isOfflineForced, subscribeOfflineForced } from "./forced-offline";

/**
 * A backend-unreachable error that the Outbox link and the Replay classifier
 * both recognise (see `packages/shared/src/lib/trpc-errors.ts`): a
 * `TRPCClientError` whose cause is a network-style `TypeError`. Reusing the real
 * unreachable shape is what makes forced-Offline faithful rather than cosmetic —
 * failing mutations flow into the Outbox and reads fall back to the persisted
 * cache exactly as they would under a genuine backend outage.
 */
function backendUnreachable(): TRPCClientError<AnyTRPCRouter> {
  return new TRPCClientError("Offline (forced): backend transport blocked", {
    cause: new TypeError("Failed to fetch"),
  });
}

/**
 * A dev-only tRPC link that faithfully blocks the transport while Offline is
 * forced (ADR-0007). It belongs in `extraLinks` — below the Outbox mutation link
 * and above the real transport link — so that when Offline is forced:
 *
 *  - queries and mutations short-circuit with a backend-unreachable error. The
 *    Outbox link above captures the failing mutation (Queued UX); reads keep
 *    their persisted-cache data;
 *  - subscriptions are *held* pending and never reach the transport, so the lazy
 *    WebSocket client is never asked to connect — true radio silence, no probes,
 *    no WS, no refetches. When the override clears, each held op is forwarded to
 *    the real transport, so the WebSocket un-suspends organically (the exit half
 *    of ADR-0007) instead of staying dead until a reload.
 *
 * When Offline is not forced it is a transparent pass-through. In production the
 * caller never adds it (OFFLINE_FORCED_AVAILABLE is false), so it ships nothing.
 */
export function createForcedOfflineLink<TRouter extends AnyTRPCRouter>(): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (!isOfflineForced()) {
        return next(op);
      }

      return observable((observer) => {
        if (op.type === "subscription") {
          // Hold it pending, like a socket that never establishes — next(op) is
          // not called, so the WebSocket transport is never engaged. On the
          // flag clearing (same-tab event or cross-tab storage), forward the op
          // downstream once, piping the live transport into the original
          // observer: to the subscription hook the exit is indistinguishable
          // from a connection finally establishing.
          let forwarded: Unsubscribable | null = null;

          const release = subscribeOfflineForced(() => {
            if (isOfflineForced() || forwarded) {
              return;
            }

            release();
            forwarded = next(op).subscribe(observer);
          });

          return () => {
            release();
            forwarded?.unsubscribe();
          };
        }

        observer.error(backendUnreachable());

        return () => {};
      });
    };
  };
}
