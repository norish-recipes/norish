import type { GrocerySubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { groceryEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

const onCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "created");

  log.debug(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to grocery created events"
  );

  try {
    for await (const data of groceryEmitter.createSubscription(eventName, signal)) {
      yield data as GrocerySubscriptionEvents["created"];
    }
  } finally {
    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from grocery created events"
    );
  }
});

const onUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "updated");

  log.debug(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to grocery updated events"
  );

  try {
    for await (const data of groceryEmitter.createSubscription(eventName, signal)) {
      yield data as GrocerySubscriptionEvents["updated"];
    }
  } finally {
    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from grocery updated events"
    );
  }
});

const onDeleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "deleted");

  log.debug(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to grocery deleted events"
  );

  try {
    for await (const data of groceryEmitter.createSubscription(eventName, signal)) {
      yield data as GrocerySubscriptionEvents["deleted"];
    }
  } finally {
    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from grocery deleted events"
    );
  }
});

const onRecurringCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "recurringCreated");

  log.debug(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to recurring grocery created events"
  );

  try {
    for await (const data of groceryEmitter.createSubscription(eventName, signal)) {
      yield data as GrocerySubscriptionEvents["recurringCreated"];
    }
  } finally {
    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from recurring grocery created events"
    );
  }
});

const onRecurringUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "recurringUpdated");

  log.debug(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to recurring grocery updated events"
  );

  try {
    for await (const data of groceryEmitter.createSubscription(eventName, signal)) {
      yield data as GrocerySubscriptionEvents["recurringUpdated"];
    }
  } finally {
    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from recurring grocery updated events"
    );
  }
});

const onRecurringDeleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "recurringDeleted");

  log.debug(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to recurring grocery deleted events"
  );

  try {
    for await (const data of groceryEmitter.createSubscription(eventName, signal)) {
      yield data as GrocerySubscriptionEvents["recurringDeleted"];
    }
  } finally {
    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from recurring grocery deleted events"
    );
  }
});

const onFailed = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = groceryEmitter.householdEvent(ctx.householdKey, "failed");

  log.debug(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to grocery failed events"
  );

  try {
    for await (const data of groceryEmitter.createSubscription(eventName, signal)) {
      yield data as GrocerySubscriptionEvents["failed"];
    }
  } finally {
    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from grocery failed events"
    );
  }
});

export const groceriesSubscriptions = router({
  onCreated,
  onUpdated,
  onDeleted,
  onRecurringCreated,
  onRecurringUpdated,
  onRecurringDeleted,
  onFailed,
});

