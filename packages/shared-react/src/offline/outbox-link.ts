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
 * Mutations of {@link isUncaptured} procedures pass straight through: never stored or timed.
 *
 * Replayed mutations carry a marker context and are skipped, so a replay is
 * never re-captured.
 *
 * A whole edit (`recipes.update`) saved while one of the same id is pending
 * waits in the Outbox: in that entry, on its version, if it was never sent.
 * The replace is one atomic change, which Replay's mark on an entry it sends excludes.
 */

import type { HTTPHeaders, Operation, OperationLink, TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import type { Unsubscribable } from "@trpc/server/observable";
import { TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";

import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import {
  isBackendUnreachableError,
  markOutboxAdmissionFailed,
} from "@norish/shared/lib/trpc-errors";

import type { LockManagerLike } from "./leader";
import type { OutboxStore } from "./outbox-store";
import type { OutboxEntry } from "./outbox-types";
import { isStaleResult } from "./error-classification";
import { encodedFormDataId, encodeOutboxInput, isEncodedFormData } from "./input-codec";
import { runIfLeader } from "./leader";
import { isOutboxReplayContext } from "./replay-client";
import { isUncaptured } from "./uncaptured";

const log = createClientLogger("OutboxLink");

/** An opted-in write unanswered this long is aborted and queued: Replay sends it again. */
export const MUTATION_SEND_TIMEOUT_MS = 20_000;

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

interface OutboxLinkDependencies {
  store: OutboxStore;
  /** The applied cache owner; admission fails while there is none. */
  owner: () => string | null;
  replayHeaderValue: string;
  /** Procedures that save a whole entity at the version it was read at; they create nothing. */
  wholeEdits?: ReadonlySet<string>;
  /** Procedures whose send, live or replayed, is aborted after {@link MUTATION_SEND_TIMEOUT_MS}. */
  timedWrites?: ReadonlySet<string>;
  /** The Replay lock: while a context holds it, another process's mark on an entry is live. */
  locks?: () => LockManagerLike | null;
  /** Told of a whole edit sent live and refused as stale; nothing is stored for it. */
  onConflict?: () => void;
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
  { store, owner, wholeEdits }: OutboxLinkDependencies,
  path: string,
  input: unknown,
  context: unknown
): Promise<OutboxEntry> {
  const encodedInput = encodeOutboxInput(input);

  return store.enqueue({
    id: createClientId(),
    ownerId: captureOwner(owner),
    path,
    input: encodedInput,
    entityId: wholeEdits?.has(path) ? null : entityIdOf(encodedInput),
    ...operationOf(context),
  });
}

function operationOf(context: unknown) {
  const ctx = (context ?? {}) as { operationId?: unknown; headers?: HTTPHeaders };

  return {
    operationId: typeof ctx.operationId === "string" ? ctx.operationId : null,
    headers: normalizeHeaders(ctx.headers),
  };
}

const idOf = (input: unknown) => (input as { id?: unknown } | null)?.id;

/** Put a whole edit in place of its recipe's unsent pending entry, on that entry's version. */
async function replaceUnsent(
  deps: OutboxLinkDependencies,
  op: Operation
): Promise<"replaced" | "kept" | "none"> {
  const ownerId = deps.owner();
  const pending = ownerId ? await deps.store.forOwner(ownerId, "pending") : [];
  const last = pending
    .filter((entry) => entry.path === op.path && idOf(entry.input) === idOf(op.input))
    .at(-1);

  if (!last) return "none";
  const own = deps.store.process;
  const take = (otherMarksStale: boolean) =>
    deps.store.change(last.seq, (stored) =>
      stored.status === "pending" &&
      stored.attempts === 0 &&
      (!stored.sending || (otherMarksStale && stored.sending !== own))
        ? {
            ...stored,
            input: {
              ...(encodeOutboxInput(op.input) as object),
              version: (stored.input as { version?: unknown }).version,
            },
            ...operationOf(op.context),
          }
        : undefined
    );
  // Another process's mark is stale unless a context holds the Replay lock (web: another tab); a
  // live one is safe to replace, as Replay's finish leaves the replacement pending.
  const locks = deps.locks?.() ?? null;
  let replaced = await take(!locks);

  if (!replaced && locks && last.sending && last.sending !== own) {
    replaced = await runIfLeader(() => take(true), locks);
  }

  return replaced ? "replaced" : "kept";
}

/** The Queued outcome for a save that went to the Outbox without being sent. */
const queuedError = () =>
  new TRPCClientError("Queued behind a pending save", { cause: new TypeError("Failed to fetch") });

/** A send that got no answer in time fails as one that never reached the backend. */
const timedOutError = () =>
  new TRPCClientError("No answer in time", { cause: new TypeError("Failed to fetch") });

export function createOutboxLink<TRouter extends AnyTRPCRouter>(
  deps: OutboxLinkDependencies
): TRPCLink<TRouter> {
  return () => {
    const capture: OperationLink<TRouter> = ({ op, next }) =>
      observable((observer) => {
        const fail = (error: TRPCClientError<TRouter>) => {
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
        };
        const timer = deps.timedWrites?.has(op.path)
          ? setTimeout(() => {
              subscription.unsubscribe();
              fail(timedOutError());
            }, MUTATION_SEND_TIMEOUT_MS)
          : undefined;
        const subscription = next(op).subscribe({
          next: (value) => {
            clearTimeout(timer);
            observer.next(value);
          },
          error: (error) => {
            clearTimeout(timer);
            fail(error);
          },
          complete: () => observer.complete(),
        });

        return () => {
          clearTimeout(timer);
          subscription.unsubscribe();
        };
      });

    return ({ op, next }) => {
      if (op.type !== "mutation" || isUncaptured(op.path)) {
        return next(op);
      }

      if (
        !deps.wholeEdits?.has(op.path) ||
        typeof idOf(op.input) !== "string" ||
        isOutboxReplayContext(op.context, deps.replayHeaderValue)
      ) {
        return capture({ op, next });
      }

      return observable((observer) => {
        let subscription: Unsubscribable | null = null;
        let closed = false;

        replaceUnsent(deps, op)
          .then(async (found) => {
            if (found === "kept") await captureToOutbox(deps, op.path, op.input, op.context);

            return found !== "none";
          })
          .then(
            (queued) => {
              if (queued) return observer.error(queuedError());
              if (closed) return;

              subscription = capture({ op, next }).subscribe({
                next: (value) => {
                  // Refused live: nothing is stored, the reader is told once.
                  if (isStaleResult("data" in value.result ? value.result.data : null)) {
                    deps.onConflict?.();
                  }
                  observer.next(value);
                },
                error: (error) => observer.error(error),
                complete: () => observer.complete(),
              });
            },
            (persistError: unknown) => {
              log.error({ error: persistError, path: op.path }, "Outbox admission failed");
              const error = queuedError();

              markOutboxAdmissionFailed(error);
              observer.error(error);
            }
          );

        return () => {
          closed = true;
          subscription?.unsubscribe();
        };
      });
    };
  };
}
