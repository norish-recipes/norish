/**
 * The Outbox tRPC mutation link.
 *
 * Sits ahead of the transport, in front of every mutation. When a mutation
 * fails because the backend is unreachable, it captures the request into the
 * IndexedDB Outbox for later Replay — by structured clone, so `File`/`Blob`
 * uploads are preserved (no serialization, no whitelist) — and then *still
 * propagates the error*. Propagating is deliberate: the hero hooks read that
 * same backend-unreachable signal to keep their optimistic state (Queued) rather
 * than roll back.
 *
 * Replayed mutations carry a marker context and are skipped, so a replay is
 * never re-captured.
 */

import type { HTTPHeaders, TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";

import { createClientId } from "@norish/shared/lib/operation-helpers";
import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

import { activeCacheOwner, readBootOwner } from "@/lib/query-cache";

import { outboxStore } from "./outbox-store";
import { isOutboxReplayContext } from "./replay-client";

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

function captureOwner(): string {
  // The entry belongs to whoever is signed in now; anon only on a pre-login edge.
  return activeCacheOwner() ?? readBootOwner() ?? "anon";
}

function cloneInput(input: unknown): unknown {
  try {
    return typeof structuredClone === "function" ? structuredClone(input) : input;
  } catch {
    // Fall back to the live reference; IndexedDB clones again on write.
    return input;
  }
}

/** The client-minted id a hero create carries as `input.id` (ADR-0003), if any. */
function entityIdOf(input: unknown): string | null {
  if (input && typeof input === "object") {
    const id = (input as { id?: unknown }).id;

    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }

  return null;
}

function captureToOutbox(path: string, input: unknown, context: unknown): void {
  const ctx = (context ?? {}) as { operationId?: unknown; headers?: HTTPHeaders };
  const operationId = typeof ctx.operationId === "string" ? ctx.operationId : null;

  void outboxStore
    .enqueue({
      id: createClientId(),
      ownerId: captureOwner(),
      path,
      input: cloneInput(input),
      entityId: entityIdOf(input),
      operationId,
      headers: normalizeHeaders(ctx.headers),
    })
    .catch(() => {
      // Best-effort — a failed enqueue must not turn into an unhandled rejection.
    });
}

export function createOutboxLink<TRouter extends AnyTRPCRouter>(): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (op.type !== "mutation") {
        return next(op);
      }

      return observable((observer) => {
        const subscription = next(op).subscribe({
          next: (value) => observer.next(value),
          error: (error) => {
            if (!isOutboxReplayContext(op.context) && isBackendUnreachableError(error)) {
              captureToOutbox(op.path, op.input, op.context);
            }

            observer.error(error);
          },
          complete: () => observer.complete(),
        });

        return () => subscription.unsubscribe();
      });
    };
  };
}
