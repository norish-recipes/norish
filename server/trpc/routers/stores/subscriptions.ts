import type { StoreSubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { storeEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

const onCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "created");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to store created events"
  );

  try {
    for await (const data of storeEmitter.createSubscription(eventName, signal)) {
      yield data as StoreSubscriptionEvents["created"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from store created events"
    );
  }
});

const onUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "updated");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to store updated events"
  );

  try {
    for await (const data of storeEmitter.createSubscription(eventName, signal)) {
      yield data as StoreSubscriptionEvents["updated"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from store updated events"
    );
  }
});

const onDeleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "deleted");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to store deleted events"
  );

  try {
    for await (const data of storeEmitter.createSubscription(eventName, signal)) {
      yield data as StoreSubscriptionEvents["deleted"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from store deleted events"
    );
  }
});

const onReordered = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "reordered");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to store reordered events"
  );

  try {
    for await (const data of storeEmitter.createSubscription(eventName, signal)) {
      yield data as StoreSubscriptionEvents["reordered"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from store reordered events"
    );
  }
});

export const storesSubscriptions = router({
  onCreated,
  onUpdated,
  onDeleted,
  onReordered,
});
