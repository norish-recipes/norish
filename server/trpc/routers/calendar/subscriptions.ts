import type { CalendarSubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { createSubscriptionIterable } from "../../helpers";

import { calendarEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

const onFailed = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "failed");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to calendar failed events"
  );

  try {
    for await (const data of createSubscriptionIterable(
      calendarEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as CalendarSubscriptionEvents["failed"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from calendar failed events"
    );
  }
});

const onItemCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "itemCreated");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to item created events"
  );

  try {
    for await (const data of createSubscriptionIterable(
      calendarEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as CalendarSubscriptionEvents["itemCreated"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from item created events"
    );
  }
});

const onItemDeleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "itemDeleted");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to item deleted events"
  );

  try {
    for await (const data of createSubscriptionIterable(
      calendarEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as CalendarSubscriptionEvents["itemDeleted"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from item deleted events"
    );
  }
});

const onItemMoved = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "itemMoved");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to item moved events"
  );

  try {
    for await (const data of createSubscriptionIterable(
      calendarEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as CalendarSubscriptionEvents["itemMoved"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from item moved events"
    );
  }
});

const onItemUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "itemUpdated");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to item updated events"
  );

  try {
    for await (const data of createSubscriptionIterable(
      calendarEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as CalendarSubscriptionEvents["itemUpdated"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from item updated events"
    );
  }
});

export const calendarSubscriptions = router({
  onFailed,
  onItemCreated,
  onItemDeleted,
  onItemMoved,
  onItemUpdated,
});
