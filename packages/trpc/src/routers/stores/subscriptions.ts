import { trpcLogger as log } from "@norish/shared-server/logger";

import type { StoreSubscriptionEvents } from "./types";
import { createSubscriptionIterable } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { storeEmitter } from "./emitter";

const onCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "created");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to store created events"
  );

  try {
    for await (const data of createSubscriptionIterable(
      storeEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
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
    for await (const data of createSubscriptionIterable(
      storeEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
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
    for await (const data of createSubscriptionIterable(
      storeEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
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
    for await (const data of createSubscriptionIterable(
      storeEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as StoreSubscriptionEvents["reordered"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from store reordered events"
    );
  }
});

const onProductUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "productUpdated");

  try {
    for await (const data of createSubscriptionIterable(
      storeEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as StoreSubscriptionEvents["productUpdated"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from store product events"
    );
  }
});

const onLinkUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "linkUpdated");

  try {
    for await (const data of createSubscriptionIterable(
      storeEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as StoreSubscriptionEvents["linkUpdated"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from product link events"
    );
  }
});

const onAisleFiled = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = storeEmitter.householdEvent(ctx.householdKey, "aisleFiled");

  try {
    for await (const data of createSubscriptionIterable(
      storeEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as StoreSubscriptionEvents["aisleFiled"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from aisle filing events"
    );
  }
});

export const storesSubscriptions = router({
  onCreated,
  onUpdated,
  onDeleted,
  onReordered,
  onProductUpdated,
  onLinkUpdated,
  onAisleFiled,
});
