/**
 * Operation ID Link
 *
 * A tRPC client link that attaches an `operationId` to mutations.
 * Online mutations get a fresh operationId; offline outbox replays
 * preserve the one already stored.
 *
 * The operationId is sent via the `x-operation-id` HTTP header so it
 * reaches the server's tRPC request context without changing
 * mutation input schemas.
 */

import type { TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";

import { createClientLogger } from "@norish/shared/lib/logger";
import { generateOperationId, isOperationId } from "@norish/shared/lib/operation-helpers";

const log = createClientLogger("operation-id");

/** HTTP header used to carry the operationId from client to server. */
export const OPERATION_ID_HEADER = "x-operation-id";

/**
 * Creates a tRPC link that ensures every mutation carries an `operationId`.
 *
 * - If the operation context already contains an `operationId` (e.g. from an
 *   offline outbox replay), it is preserved.
 * - Otherwise a fresh `operationId` is generated.
 * - Non-mutation operations (queries, subscriptions) pass through unchanged.
 *
 * The operationId is attached to both the context (for downstream links)
 * and the headers (for server-side context creation).
 */
export function createOperationIdLink<TRouter extends AnyTRPCRouter>(): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (op.type !== "mutation") {
        return next(op);
      }

      // Check if an operationId was already attached (e.g. outbox replay)
      const existingId = (op.context as Record<string, unknown>)?.operationId;
      const operationId = isOperationId(existingId) ? existingId : generateOperationId();

      log.debug(`OperationID:  ${op.path} [${operationId}]`);

      const result$ = next({
        ...op,
        context: {
          ...op.context,
          operationId,
          // Merge into headers so httpLink/httpBatchLink sends it to the server
          headers: {
            ...((op.context as Record<string, unknown>)?.headers as
              | Record<string, string>
              | undefined),
            [OPERATION_ID_HEADER]: operationId,
          },
        },
      });

      return observable((observer) => {
        return result$.subscribe({
          next(value) {
            log.trace(`OP: ${op.path} [${operationId}] ok`);
            observer.next(value);
          },
          error(err) {
            log.warn(`OP Error: ${op.path} [${operationId}] error: ${(err as Error).message}`);
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
      });
    };
  };
}
