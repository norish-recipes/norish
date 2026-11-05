/**
 * The Outbox tRPC mutation link.
 *
 * Sits ahead of the transport, in front of every mutation. When a mutation
 * fails because the backend is unreachable, it runs the input through the
 * explicit Outbox codec (`FormData` becomes a tagged ordered entry list;
 * everything else is structured-cloned), **awaits** the storage write, and
 * only then propagates the backend-unreachable error — that signal is the
 * Queued outcome the hero hooks key off, so Queued now means durably stored
 * (ADR-0009). If admission fails, the propagated error is marked so those
 * same consumers present a real failure and roll back instead.
 *
 * Replayed mutations carry a marker context and are skipped, so a replay is
 * never re-captured.
 */

import type { HTTPHeaders, TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";

import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import {
  isBackendUnreachableError,
  markOutboxAdmissionFailed,
} from "@norish/shared/lib/trpc-errors";

import type { OutboxStore } from "./outbox-store";
import { encodedFormDataId, encodeOutboxInput, isEncodedFormData } from "./input-codec";
import { isOutboxReplayContext } from "./replay-client";

const log = createClientLogger("OutboxLink");

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers as Record<string, string | string[] | undefined>).flatMap(
      ([key, value]) => {
        if (typeof value === "undefined") {
          return [];
        }

        return [[key, Array.isArray(value) ? value.join(", ") : value]] as [string, string][];
      }
    )
  );
}

export interface OutboxLinkDependencies {
  store: OutboxStore;
  /** The applied cache owner; admission fails while there is none. */
  owner: () => string | null;
  replayHeaderValue: string;
}

function captureOwner(owner: () => string | null): string {
  const current = owner();

  if (!current) {
    throw new Error("Cannot queue an offline mutation before cache ownership is established");
  }

  return current;
}

/** The client-minted id a hero create carries as `input.id` (ADR-0003), if any. */
function entityIdOf(input: unknown): string | null {
  if (isEncodedFormData(input)) {
    return encodedFormDataId(input);
  }

  if (input && typeof input === "object") {
    const id = (input as { id?: unknown }).id;

    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }

  return null;
}

/** Durably admit the mutation to the Outbox; rejects when persistence fails. */
async function captureToOutbox(
  { store, owner }: OutboxLinkDependencies,
  path: string,
  input: unknown,
  context: unknown
): Promise<void> {
  const ctx = (context ?? {}) as { operationId?: unknown; headers?: HTTPHeaders };
  const operationId = typeof ctx.operationId === "string" ? ctx.operationId : null;
  const encodedInput = encodeOutboxInput(input);

  await store.enqueue({
    id: createClientId(),
    ownerId: captureOwner(owner),
    path,
    input: encodedInput,
    entityId: entityIdOf(encodedInput),
    operationId,
    headers: normalizeHeaders(ctx.headers),
  });
}

export function createOutboxLink<TRouter extends AnyTRPCRouter>(
  deps: OutboxLinkDependencies
): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (op.type !== "mutation") {
        return next(op);
      }

      return observable((observer) => {
        const subscription = next(op).subscribe({
          next: (value) => observer.next(value),
          error: (error) => {
            if (
              isOutboxReplayContext(op.context, deps.replayHeaderValue) ||
              !isBackendUnreachableError(error)
            ) {
              observer.error(error);

              return;
            }

            // Queued means durably stored: hold the error until the entry is
            // in storage, and downgrade it to a real failure if it is not.
            void Promise.resolve()
              .then(() => captureToOutbox(deps, op.path, op.input, op.context))
              .then(
                () => observer.error(error),
                (persistError: unknown) => {
                  log.error(
                    { error: persistError, path: op.path },
                    "Outbox admission failed; presenting mutation as failed"
                  );
                  markOutboxAdmissionFailed(error);
                  observer.error(error);
                }
              );
          },
          complete: () => observer.complete(),
        });

        return () => subscription.unsubscribe();
      });
    };
  };
}
