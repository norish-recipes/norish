import type { TypedEmitter } from "./emitter";
import type { PermissionLevel } from "@/server/db/zodSchemas/server-config";
import type { SubscriptionMultiplexer } from "@/server/redis/subscription-multiplexer";

import { authedProcedure } from "./middleware";

import { trpcLogger as log } from "@/server/logger";

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

/**
 * Context for policy-based event emission.
 */
export interface PolicyEmitContext {
  userId: string;
  householdKey: string;
}

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
  if (multiplexer) {
    return multiplexer.subscribe<T>(channel, signal);
  }

  return emitter.createSubscription(channel, signal) as AsyncIterable<T>;
}

/**
 * Emit events based on the view policy.
 * - "everyone" => broadcast to all users
 * - "household" => emit to household only
 * - "owner" => emit to the owner only
 *
 * @example
 * ```ts
 * emitByPolicy(recipeEmitter, viewPolicy, ctx, "created", { recipe });
 * ```
 */
export function emitByPolicy<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
>(
  emitter: TypedEmitter<TEvents>,
  viewPolicy: PermissionLevel,
  ctx: PolicyEmitContext,
  event: K,
  data: TEvents[K]
): void {
  log.debug(
    { event, viewPolicy, householdKey: ctx.householdKey, userId: ctx.userId },
    `Emitting event via policy`
  );

  switch (viewPolicy) {
    case "everyone":
      emitter.broadcast(event, data);
      log.debug({ event }, "Broadcast event emitted");
      break;
    case "household":
      emitter.emitToHousehold(ctx.householdKey, event, data);
      log.debug({ event, householdKey: ctx.householdKey }, "Household event emitted");
      break;
    case "owner":
      emitter.emitToUser(ctx.userId, event, data);
      log.debug({ event, userId: ctx.userId }, "User event emitted");
      break;
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

  // Start all iterators
  for (let i = 0; i < iterators.length; i++) {
    pending.set(
      i,
      iterators[i].next().then((result) => ({ index: i, result }))
    );
  }

  try {
    while (pending.size > 0) {
      if (signal?.aborted) break;

      const { index, result } = await Promise.race(pending.values());

      if (result.done) {
        pending.delete(index);
      } else {
        yield result.value;
        pending.set(
          index,
          iterators[index].next().then((r) => ({ index, result: r }))
        );
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
export function createPolicyAwareIterables<TEvents extends Record<string, unknown>>(
  emitter: TypedEmitter<TEvents>,
  ctx: PolicySubscribeContext,
  event: keyof TEvents & string,
  signal?: AbortSignal
): AsyncIterable<TEvents[typeof event]>[] {
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
      ctx.multiplexer.subscribe<TEvents[typeof event]>(householdEventName, signal),
      ctx.multiplexer.subscribe<TEvents[typeof event]>(broadcastEventName, signal),
      ctx.multiplexer.subscribe<TEvents[typeof event]>(userEventName, signal),
    ];
  }

  // Fallback to direct subscriptions (HTTP polling, tests, etc.)
  return [
    emitter.createSubscription(householdEventName, signal),
    emitter.createSubscription(broadcastEventName, signal),
    emitter.createSubscription(userEventName, signal),
  ];
}

export function createPolicyAwareSubscription<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
>(emitter: TypedEmitter<TEvents>, eventName: K, logMessage: string) {
  return authedProcedure.subscription(async function* ({ ctx, signal }) {
    const policyCtx: PolicySubscribeContext = {
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
      multiplexer: ctx.multiplexer,
    };

    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey, hasMultiplexer: !!ctx.multiplexer },
      `Subscribed to ${logMessage}`
    );

    try {
      const iterables = createPolicyAwareIterables(emitter, policyCtx, eventName, signal);

      for await (const data of mergeAsyncIterables(iterables, signal)) {
        yield data as TEvents[K];
      }
    } finally {
      log.trace(
        { userId: ctx.user.id, householdKey: ctx.householdKey },
        `Unsubscribed from ${logMessage}`
      );
    }
  });
}
