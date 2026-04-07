import type { ReachabilitySnapshot } from "@/lib/network/reachability-store";
import type { HTTPHeaders, TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import {
  getReachabilitySnapshot,
  subscribeToReachabilitySnapshot,
} from "@/lib/network/reachability-store";
import { observable } from "@trpc/server/observable";
import superjson from "superjson";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { OutboxRequestMetadata } from "./outbox-types";
import { isBackendUnreachableError } from "./error-classification";
import { processQueue } from "./outbox-replay";
import { isOutboxReplayContext } from "./outbox-replay-client";
import * as outboxStore from "./outbox-store";

const log = createClientLogger("outbox-link");

function normalizeHeaders(headers: HTTPHeaders | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (typeof (headers as Headers)[Symbol.iterator] === "function") {
    return Object.fromEntries(headers as Iterable<[string, string]>);
  }

  return Object.fromEntries(
    Object.entries(headers as Record<string, string | string[] | undefined>).flatMap(
      ([key, value]) => {
        if (typeof value === "undefined") {
          return [];
        }

        return [[key, Array.isArray(value) ? value.join(", ") : value]];
      }
    )
  );
}

function getRequestMetadata(context: unknown): OutboxRequestMetadata {
  const opContext = (context ?? {}) as Record<string, unknown>;

  return {
    operationId:
      typeof opContext.operationId === "string" && opContext.operationId.length > 0
        ? opContext.operationId
        : null,
    headers: normalizeHeaders(opContext.headers as HTTPHeaders | undefined),
  };
}

export function createOutboxLink<TRouter extends AnyTRPCRouter>(): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (op.type !== "mutation") {
        return next(op);
      }

      return observable((observer) => {
        const sub = next(op).subscribe({
          next(value) {
            observer.next(value);
          },

          error(error) {
            if (!isOutboxReplayContext(op.context) && isBackendUnreachableError(error)) {
              try {
                const serializedInput = superjson.stringify(op.input);

                outboxStore.enqueue(op.path, serializedInput, getRequestMetadata(op.context));

                log.debug(`Captured failed mutation to outbox: ${op.path}`);
              } catch (enqueueError) {
                log.warn({ error: enqueueError }, `Failed to enqueue mutation: ${op.path}`);
              }
            }

            observer.error(error);
          },

          complete() {
            observer.complete();
          },
        });

        return () => {
          sub.unsubscribe();
        };
      });
    };
  };
}

type UnsubscribeFn = () => void;

function isBackendReachable(snapshot: ReachabilitySnapshot): boolean {
  return snapshot.runtimeState === "ready" && snapshot.appOnline;
}

export function subscribeToReachability(onReachable: (reachable: boolean) => void): UnsubscribeFn {
  let wasReachable = isBackendReachable(getReachabilitySnapshot());

  return subscribeToReachabilitySnapshot((snapshot) => {
    const reachable = isBackendReachable(snapshot);

    if (reachable !== wasReachable) {
      wasReachable = reachable;
      onReachable(reachable);
    }
  });
}

export function startOutboxProcessor(): UnsubscribeFn {
  const snapshot = getReachabilitySnapshot();

  if (isBackendReachable(snapshot)) {
    void processQueue();
  }

  return subscribeToReachability((reachable) => {
    if (reachable) {
      log.debug("Backend became reachable, triggering outbox replay");
      void processQueue();
    }
  });
}
