/**
 * CalDAV tRPC Subscriptions
 *
 * Real-time WebSocket subscriptions for CalDAV sync status updates.
 */

import type { CaldavSubscriptionEvents } from "./types";

import { caldavEmitter } from "./emitter";

import { router } from "@/server/trpc/trpc";
import { authedProcedure } from "@/server/trpc/middleware";
import { mergeAsyncIterables } from "@/server/trpc/helpers";
import { trpcLogger as log } from "@/server/logger";

/**
 * Subscribe to all CalDAV sync events for the current user.
 * Yields a union type with event type discriminator.
 */
const onSyncEvent = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;

  log.debug({ userId }, "Subscribed to CalDAV sync events");

  // Create event iterables for all event types
  const eventNames = [
    "configSaved",
    "syncStarted",
    "syncCompleted",
    "syncFailed",
    "itemStatusUpdated",
    "initialSyncComplete",
  ] as const;

  type EventName = (typeof eventNames)[number];

  // Create iterables for each event type and wrap data with type discriminator
  const iterables = eventNames.map((eventName) => {
    const userEventName = caldavEmitter.userEvent(userId, eventName);

    return (async function* () {
      for await (const data of caldavEmitter.createSubscription(userEventName, signal)) {
        yield { type: eventName, data } as {
          type: EventName;
          data: CaldavSubscriptionEvents[EventName];
        };
      }
    })();
  });

  try {
    for await (const event of mergeAsyncIterables(iterables, signal)) {
      yield event;
    }
  } finally {
    log.debug({ userId }, "Unsubscribed from CalDAV sync events");
  }
});

/**
 * Subscribe only to item status updates.
 * Useful for updating the sync status table in real-time.
 */
const onItemStatusUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = caldavEmitter.userEvent(userId, "itemStatusUpdated");

  log.debug({ userId }, "Subscribed to CalDAV item status updates");

  try {
    for await (const data of caldavEmitter.createSubscription(eventName, signal)) {
      yield data as CaldavSubscriptionEvents["itemStatusUpdated"];
    }
  } finally {
    log.debug({ userId }, "Unsubscribed from CalDAV item status updates");
  }
});

/**
 * Subscribe to sync completion events.
 */
const onSyncCompleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = caldavEmitter.userEvent(userId, "syncCompleted");

  log.debug({ userId }, "Subscribed to CalDAV sync completed events");

  try {
    for await (const data of caldavEmitter.createSubscription(eventName, signal)) {
      yield data as CaldavSubscriptionEvents["syncCompleted"];
    }
  } finally {
    log.debug({ userId }, "Unsubscribed from CalDAV sync completed events");
  }
});

/**
 * Subscribe to sync failure events.
 */
const onSyncFailed = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = caldavEmitter.userEvent(userId, "syncFailed");

  log.debug({ userId }, "Subscribed to CalDAV sync failed events");

  try {
    for await (const data of caldavEmitter.createSubscription(eventName, signal)) {
      yield data as CaldavSubscriptionEvents["syncFailed"];
    }
  } finally {
    log.debug({ userId }, "Unsubscribed from CalDAV sync failed events");
  }
});

/**
 * Subscribe to initial sync complete events.
 */
const onInitialSyncComplete = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = caldavEmitter.userEvent(userId, "initialSyncComplete");

  log.debug({ userId }, "Subscribed to CalDAV initial sync complete events");

  try {
    for await (const data of caldavEmitter.createSubscription(eventName, signal)) {
      yield data as CaldavSubscriptionEvents["initialSyncComplete"];
    }
  } finally {
    log.debug({ userId }, "Unsubscribed from CalDAV initial sync complete events");
  }
});

export const caldavSubscriptions = router({
  onSyncEvent,
  onItemStatusUpdated,
  onSyncCompleted,
  onSyncFailed,
  onInitialSyncComplete,
});

export type CaldavSubscriptionsRouter = typeof caldavSubscriptions;
