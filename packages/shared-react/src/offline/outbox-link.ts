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
 *
 * Edits of one entity (`{ id, version }`) go one at a time, live and replayed
 * alike. An answer `{ stale: false, version }` moves the later edits sent on
 * the same base, in memory and in the Outbox, to the version it stored: our
 * own write is the only change they skip over, so another member's still wins.
 */

import type {
  HTTPHeaders,
  Operation,
  OperationLink,
  OperationResultEnvelope,
  TRPCClientError,
  TRPCLink,
} from "@trpc/client";
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

interface OutboxLinkDependencies {
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

type VersionedEdit = { id: string; version: number };

/** An input that edits one entity at the version it was read at: `{ id, version }`. */
function versionedEdit(input: unknown): VersionedEdit | null {
  if (!input || typeof input !== "object" || isEncodedFormData(input)) return null;
  const { id, version } = input as { id?: unknown; version?: unknown };

  return typeof id === "string" && typeof version === "number" ? { id, version } : null;
}

/** The version an answer says it stored: `{ stale: false, version }`. */
function storedVersion(value: unknown): number | null {
  const data = (value as { result?: { data?: unknown } } | undefined)?.result?.data;
  const { stale, version } = (data ?? {}) as { stale?: unknown; version?: unknown };

  return stale === false && typeof version === "number" ? version : null;
}

export function createOutboxLink<TRouter extends AnyTRPCRouter>(
  deps: OutboxLinkDependencies
): TRPCLink<TRouter> {
  // Our own stored edits, `path id sent` to stored: a later edit on that base is sent on top of it.
  const forwards = new Map<string, number>();
  // One edit of an entity at a time, so each is sent after the last one's answer.
  const tails = new Map<string, Promise<void>>();

  /** Move the Outbox's pending edits of the entity from our sent version to the stored one. */
  async function moveQueued(op: Operation, edit: VersionedEdit, stored: number): Promise<void> {
    const operationId = (op.context as { operationId?: unknown } | undefined)?.operationId;

    for (const entry of await deps.store.loadAll()) {
      const queued = versionedEdit(entry.input);

      if (
        entry.status === "pending" &&
        entry.path === op.path &&
        entry.operationId !== operationId &&
        queued?.id === edit.id &&
        queued.version === edit.version
      ) {
        await deps.store.update(entry.seq, {
          input: { ...(entry.input as object), version: stored },
        });
      }
    }
  }

  return () => {
    const capture = ({ op, next }: Parameters<OperationLink<TRouter>>[0]) =>
      observable<OperationResultEnvelope<unknown, TRPCClientError<TRouter>>, TRPCClientError<TRouter>>(
        (observer) => {
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
        }
      );

    return ({ op, next }) => {
      if (op.type !== "mutation") {
        return next(op);
      }

      const edit = versionedEdit(op.input);

      if (!edit) {
        return capture({ op, next });
      }

      return observable((observer) => {
        const entity = `${op.path} ${edit.id}`;
        let resolveSettled = () => {};
        const settled = new Promise<void>((resolve) => (resolveSettled = resolve));
        const release = () => {
          resolveSettled();
          if (tails.get(entity) === settled) tails.delete(entity);
        };
        const previous = tails.get(entity) ?? Promise.resolve();
        let subscription: { unsubscribe: () => void } | null = null;
        let closed = false;

        tails.set(entity, settled);
        void previous.then(() => {
          if (closed) return release();
          let version = edit.version;

          while (forwards.has(`${entity} ${version}`)) version = forwards.get(`${entity} ${version}`)!;
          const sent = { ...edit, version };
          let answered: Promise<void> = Promise.resolve();

          subscription = capture({
            op: { ...op, input: { ...(op.input as object), version } },
            next,
          }).subscribe({
            next: (value) => {
              const stored = storedVersion(value);

              if (stored === null || stored <= version) return observer.next(value);
              forwards.set(`${entity} ${version}`, stored);
              // Stored before the answer passes on, so a restart finds the queued edits moved.
              answered = moveQueued(op, sent, stored)
                .catch((error: unknown) => log.error({ error }, "Moving queued edits failed"))
                .then(() => observer.next(value));
            },
            error: (error) => {
              release();
              observer.error(error);
            },
            complete: () =>
              void answered.then(() => {
                release();
                observer.complete();
              }),
          });
        });

        return () => {
          closed = true;
          subscription?.unsubscribe();
          release();
        };
      });
    };
  };
}
