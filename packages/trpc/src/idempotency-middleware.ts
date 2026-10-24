/**
 * Operation-ID Idempotency Middleware
 *
 * Outbox Replay can deliver a mutation twice (connection lost between server
 * commit and client ack), so duplicate-safety is mandatory. This generic,
 * path-agnostic middleware makes every authenticated mutation idempotent:
 *
 * - Mutations carrying an `operationId` (from the `x-operation-id` header)
 *   atomically claim that id in Valkey for five minutes and store their
 *   serialized (superjson) response for seven days.
 * - A repeat with the same id returns the stored response without re-executing
 *   the handler.
 *
 * Valkey is already a hard dependency (realtime pub/sub) and every client already
 * sends `x-operation-id` on mutations, so the mobile outbox becomes duplicate-safe
 * with zero client changes. See ADR-0002.
 *
 * Only successful responses are cached: a handler that throws releases its claim
 * so a later replay can re-attempt (a transient failure must not be memoized into
 * a permanent one).
 */

import { TRPCError } from "@trpc/server";
import superjson from "superjson";

import { getPublisherClient } from "@norish/shared-server/valkey/client";

import { middleware } from "./trpc";

/** Valkey key prefix for idempotency claims. Scoped per user to avoid cross-user response leakage. */
const KEY_PREFIX = "norish:idempotency:";

/**
 * How long a stored response lives in Valkey. Must comfortably exceed realistic
 * offline periods for the supported scenarios; an Outbox entry replayed after
 * this window could still duplicate (ADR-0002).
 */
export const IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * How long a claim lives while its owner runs. An owner that dies mid-request
 * leaves the claim behind, and every retry waits on it until it expires.
 */
export const IDEMPOTENCY_CLAIM_TTL_SECONDS = 5 * 60;

/**
 * What we store in Valkey under an idempotency key.
 *
 * The claim writes `{ done: false }` as a placeholder while the owning request
 * runs; on success the owner overwrites it with `{ done: true, response }` carrying
 * the handler output. A concurrent duplicate reads this back and branches on `done`,
 * so an in-flight owner and a completed response are told apart.
 */
type IdempotencyRecord = { done: false } | { done: true; response: unknown };

/** Placeholder stored (via superjson, like every record) while the owner executes. */
const PENDING_RECORD = superjson.stringify({ done: false } satisfies IdempotencyRecord);

/** Poll cadence and budget for a concurrent duplicate waiting on an in-flight owner. */
const DEFAULT_POLL_INTERVAL_MS = 50;
// ~10s ceiling: comfortably outlasts slow-but-successful owners (recipe+image,
// large grocery batches) so a racing duplicate waits for the real response rather
// than giving up and surfacing a spurious retryable error.
const DEFAULT_POLL_MAX_ATTEMPTS = 200;

/**
 * Minimal structural view of the Valkey client we depend on. `getPublisherClient`
 * (ioredis) satisfies this; tests inject an in-memory fake.
 */
export interface IdempotencyValkey {
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
}

export interface IdempotencyConfig {
  getValkey: () => Promise<IdempotencyValkey>;
  claimTtlSeconds: number;
  ttlSeconds: number;
  pollIntervalMs: number;
  pollMaxAttempts: number;
}

const DEFAULT_CONFIG: IdempotencyConfig = {
  getValkey: getPublisherClient,
  claimTtlSeconds: IDEMPOTENCY_CLAIM_TTL_SECONDS,
  ttlSeconds: IDEMPOTENCY_TTL_SECONDS,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  pollMaxAttempts: DEFAULT_POLL_MAX_ATTEMPTS,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeDel(valkey: IdempotencyValkey, key: string): Promise<void> {
  try {
    await valkey.del(key);
  } catch {
    // Best-effort release; the TTL will reclaim the key regardless.
  }
}

/**
 * Core idempotency logic, decoupled from tRPC so it can be unit-tested with a
 * fake `next` and an in-memory Valkey.
 *
 * Generic over the middleware result shape `TResult`: the caller supplies how to
 * read ok/data from a result and how to synthesize a cached result. Non-mutations
 * and mutations without an operationId pass straight through.
 */
export async function runWithIdempotency<TResult>(
  params: {
    isMutation: boolean;
    operationId: string | null | undefined;
    userId: string | null | undefined;
    next: () => Promise<TResult>;
    isOk: (result: TResult) => boolean;
    getData: (result: TResult) => unknown;
    toCachedResult: (data: unknown) => TResult;
  },
  config: IdempotencyConfig = DEFAULT_CONFIG
): Promise<TResult> {
  const { isMutation, operationId, userId, next, isOk, getData, toCachedResult } = params;

  // Idempotency only applies to mutations that carry a correlation id.
  if (!isMutation || !operationId) {
    return next();
  }

  const key = `${KEY_PREFIX}${userId ?? "anon"}:${operationId}`;
  const valkey = await config.getValkey();

  for (let attempt = 0; attempt <= config.pollMaxAttempts; attempt++) {
    // Atomically claim the id. NX succeeds only if no one else holds it.
    const claimed = await valkey.set(key, PENDING_RECORD, "EX", config.claimTtlSeconds, "NX");

    if (claimed === "OK") {
      let result: TResult;

      try {
        result = await next();
      } catch (err) {
        // Do not memoize failures — release the claim so a replay can retry.
        await safeDel(valkey, key);
        throw err;
      }

      if (isOk(result)) {
        const record: IdempotencyRecord = { done: true, response: getData(result) };

        await valkey.set(key, superjson.stringify(record), "EX", config.ttlSeconds);
      } else {
        await safeDel(valkey, key);
      }

      return result;
    }

    // Someone else owns (or owned) this id. Read what they stored.
    const stored = await valkey.get(key);

    if (stored !== null) {
      const record = superjson.parse<IdempotencyRecord>(stored);

      if (record.done) {
        // Completed response — return it without re-executing.
        return toCachedResult(record.response);
      }
    }

    // `stored` is the pending placeholder (owner in-flight) or null (owner released
    // or TTL expired). Wait briefly, then retry the loop — a null lets us re-claim
    // and make progress; a pending record resolves once the owner finishes.
    if (attempt < config.pollMaxAttempts) {
      await sleep(config.pollIntervalMs);
    }
  }

  // The owner held the claim longer than our poll budget. Surface a retryable
  // error rather than risk a duplicate execution; the Outbox will replay it.
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Operation already in progress; retry shortly",
  });
}

/**
 * tRPC's internal marker tagged onto every middleware result so a `next()` can't
 * be accidentally dropped. We reproduce it verbatim when short-circuiting with a
 * cached response. If tRPC ever changes this value the procedure builder rejects
 * the result and our tests fail loudly, so the coupling is safe.
 */
const MIDDLEWARE_OK_MARKER = "middlewareMarker" as "middlewareMarker" & {
  __brand: "middlewareMarker";
};

/**
 * Build the synthetic middleware "ok" result used to short-circuit a duplicate
 * with a cached response. Shaped exactly like tRPC's own resolver output so the
 * procedure caller returns `data` unchanged.
 */
export function cachedMiddlewareResult(data: unknown) {
  return { ok: true as const, data, marker: MIDDLEWARE_OK_MARKER };
}

/**
 * The idempotency middleware, wired for real use. Reads `operationId` and the
 * authenticated user id from context; both are present on `authedProcedure`.
 */
export const withIdempotency = middleware(async ({ ctx, type, next }) =>
  runWithIdempotency({
    isMutation: type === "mutation",
    operationId: ctx.operationId,
    userId: ctx.user?.id,
    next,
    isOk: (result) => result.ok,
    getData: (result) => (result.ok ? result.data : undefined),
    toCachedResult: cachedMiddlewareResult,
  })
);
