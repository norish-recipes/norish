import type { TRPCSubscriptionProcedure } from "@trpc/server";

import type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
import type { SubscriptionMultiplexer } from "@norish/shared-server/redis/subscription-multiplexer";
import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime-envelope";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { assertEventEnvelope, unwrapPayload } from "@norish/shared/lib/operation-helpers";

import type { TypedEmitter } from "./emitter";
import { authedProcedure } from "./middleware";

type AuthedSubscriptionProcedure = TRPCSubscriptionProcedure<{
  input: void;
  output: AsyncIterable<unknown, void, any>;
  meta: object;
}>;

/**
 * Wait for the abort signal to fire.
 * Use this in subscriptions that can't proceed (e.g., no household)
 * but need to stay "active" so they restart on reconnection.
 *
 * @example
 * ```ts
 * if (!ctx.household) {
 *   await waitForAbort(signal);
 *   return;
 * }
 * ```
 */
export async function waitForAbort(signal?: AbortSignal): Promise<void> {
  if (!signal) return;
  if (signal.aborted) return;

  await new Promise<void>((resolve) => {
    const handler = () => {
      signal.removeEventListener("abort", handler);
      resolve();
    };

    signal.addEventListener("abort", handler, { once: true });
  });
}

export type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
export { emitByPolicy } from "@norish/shared-server/realtime/policy";

/**
 * Extended context for subscriptions that includes the multiplexer.
 */
export interface PolicySubscribeContext extends PolicyEmitContext {
  multiplexer: SubscriptionMultiplexer | null;
}

/**
 * Create a subscription iterable that uses the multiplexer if available.
 * Falls back to direct emitter subscription for HTTP or test contexts.
 *
 * @example
 * ```ts
 * for await (const data of createSubscriptionIterable(emitter, ctx.multiplexer, channelName, signal)) {
 *   yield data;
 * }
 * ```
 */
export function createSubscriptionIterable<T>(
  emitter: TypedEmitter<Record<string, T>>,
  multiplexer: SubscriptionMultiplexer | null,
  channel: string,
  signal?: AbortSignal
): AsyncIterable<T> {
  const iterable = multiplexer
    ? multiplexer.subscribe<unknown>(channel, signal)
    : emitter.createSubscription(channel, signal);

  return unwrapSubscriptionIterable<T>(iterable);
}

async function* unwrapSubscriptionIterable<T>(iterable: AsyncIterable<unknown>): AsyncGenerator<T> {
  for await (const data of iterable) {
    yield unwrapPayload<T>(data);
  }
}

export function createEnvelopeSubscriptionIterable<T>(
  emitter: TypedEmitter<Record<string, T>>,
  multiplexer: SubscriptionMultiplexer | null,
  channel: string,
  signal?: AbortSignal
): AsyncIterable<RealtimeEventEnvelope<T>> {
  const iterable = multiplexer
    ? multiplexer.subscribe<unknown>(channel, signal)
    : emitter.createSubscription(channel, signal);

  return assertEnvelopeSubscriptionIterable<T>(iterable, channel);
}

async function* assertEnvelopeSubscriptionIterable<T>(
  iterable: AsyncIterable<unknown>,
  channel: string
): AsyncGenerator<RealtimeEventEnvelope<T>> {
  for await (const data of iterable) {
    try {
      assertEventEnvelope<T>(
        data,
        `Expected realtime event envelope from subscription channel "${channel}"`
      );
    } catch (err) {
      log.error({ err, channel }, "Rejected non-envelope realtime subscription data");
      throw err;
    }

    yield data;
  }
}

/**
 * Merges multiple async iterables into one.
 * Yields from whichever source produces a value first.
 *
 * @example
 * ```ts
 * const iterables = createPolicyAwareIterables(emitter, ctx, "imported", signal);
 * for await (const data of mergeAsyncIterables(iterables, signal)) {
 *   yield data;
 * }
 * ```
 */
export async function* mergeAsyncIterables<T>(
  iterables: AsyncIterable<T>[],
  signal?: AbortSignal
): AsyncGenerator<T> {
  const iterators = iterables.map((it) => it[Symbol.asyncIterator]());
  const pending = new Map<number, Promise<{ index: number; result: IteratorResult<T> }>>();

  // Helper to schedule next() on microtask queue to prevent synchronous promise chain buildup.
  const scheduleNext = (idx: number) => {
    // Guard against scheduling after abort to avoid dangling microtasks after teardown
    if (signal?.aborted) return;

    pending.set(
      idx,
      new Promise((resolve, reject) => {
        queueMicrotask(() => {
          // Double-check abort inside microtask since signal may have changed
          if (signal?.aborted) return;
          const iterator = iterators[idx];

          if (!iterator) {
            return;
          }

          iterator.next().then((result) => resolve({ index: idx, result }), reject);
        });
      })
    );
  };

  // Start all iterators
  for (let i = 0; i < iterators.length; i++) {
    scheduleNext(i);
  }

  try {
    while (pending.size > 0) {
      if (signal?.aborted) break;

      const { index, result } = await Promise.race(pending.values());

      if (result.done) {
        pending.delete(index);
      } else {
        yield result.value;
        scheduleNext(index);
      }
    }
  } finally {
    // Cleanup: return all iterators
    await Promise.all(iterators.map((it) => it.return?.()));
  }
}

/**
 * Creates iterables for all three event channels (household, broadcast, user).
 * Uses the multiplexer if available (WebSocket connections), falls back to direct subscriptions.
 *
 * @example
 * ```ts
 * const iterables = createPolicyAwareIterables(emitter, ctx, "imported", signal);
 * for await (const data of mergeAsyncIterables(iterables, signal)) {
 *   yield data as RecipeSubscriptionEvents["imported"];
 * }
 * ```
 */
export function createPolicyAwareIterables<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
>(
  emitter: TypedEmitter<TEvents>,
  ctx: PolicySubscribeContext,
  event: K,
  signal?: AbortSignal
): AsyncIterable<RealtimeEventEnvelope<TEvents[K]>>[] {
  const householdEventName = emitter.householdEvent(ctx.householdKey, event);
  const broadcastEventName = emitter.broadcastEvent(event);
  const userEventName = emitter.userEvent(ctx.userId, event);

  log.trace(
    {
      event,
      householdEventName,
      broadcastEventName,
      userEventName,
      hasMultiplexer: !!ctx.multiplexer,
    },
    "Creating policy-aware iterables"
  );

  // Use multiplexer if available (WebSocket connections)
  // This consolidates all subscriptions into a single Redis connection
  if (ctx.multiplexer) {
    return [
      assertEnvelopeSubscriptionIterable<TEvents[K]>(
        ctx.multiplexer.subscribe<unknown>(householdEventName, signal),
        householdEventName
      ),
      assertEnvelopeSubscriptionIterable<TEvents[K]>(
        ctx.multiplexer.subscribe<unknown>(broadcastEventName, signal),
        broadcastEventName
      ),
      assertEnvelopeSubscriptionIterable<TEvents[K]>(
        ctx.multiplexer.subscribe<unknown>(userEventName, signal),
        userEventName
      ),
    ];
  }

  // Fallback to direct subscriptions (HTTP polling, tests, etc.)
  return [
    assertEnvelopeSubscriptionIterable<TEvents[K]>(
      emitter.createSubscription<K>(householdEventName, signal),
      householdEventName
    ),
    assertEnvelopeSubscriptionIterable<TEvents[K]>(
      emitter.createSubscription<K>(broadcastEventName, signal),
      broadcastEventName
    ),
    assertEnvelopeSubscriptionIterable<TEvents[K]>(
      emitter.createSubscription<K>(userEventName, signal),
      userEventName
    ),
  ];
}

/**
 * Envelope-aware subscription: yields full RealtimeEventEnvelope objects.
 * This is the canonical subscription path.
 *
 * @example
 * ```ts
 * const onImported = createEnvelopeAwareSubscription(recipeEmitter, "imported", "recipe imports");
 * ```
 */
export function createEnvelopeAwareSubscription<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
>(emitter: TypedEmitter<TEvents>, eventName: K, logMessage: string): AuthedSubscriptionProcedure {
  return authedProcedure.subscription(async function* ({ ctx, signal }) {
    if (!ctx.user) {
      await waitForAbort(signal);

      return;
    }

    const policyCtx: PolicySubscribeContext = {
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
      multiplexer: ctx.multiplexer,
    };

    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey, hasMultiplexer: !!ctx.multiplexer },
      `Subscribed (envelope-aware) to ${logMessage}`
    );

    try {
      const iterables = createPolicyAwareIterables(emitter, policyCtx, eventName, signal);

      for await (const data of mergeAsyncIterables(iterables, signal)) {
        // Yield the full envelope — consumers get { meta, payload }
        yield data;
      }
    } finally {
      log.trace(
        { userId: ctx.user.id, householdKey: ctx.householdKey },
        `Unsubscribed (envelope-aware) from ${logMessage}`
      );
    }
  });
}
