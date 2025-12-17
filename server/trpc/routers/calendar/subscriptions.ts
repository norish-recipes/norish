import type { CalendarSubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { calendarEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

const onRecipePlanned = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "recipePlanned");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to recipe planned events"
  );

  try {
    for await (const data of calendarEmitter.createSubscription(eventName, signal)) {
      yield data as CalendarSubscriptionEvents["recipePlanned"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from recipe planned events"
    );
  }
});

const onRecipeDeleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "recipeDeleted");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to recipe deleted events"
  );

  try {
    for await (const data of calendarEmitter.createSubscription(eventName, signal)) {
      yield data as CalendarSubscriptionEvents["recipeDeleted"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from recipe deleted events"
    );
  }
});

const onRecipeUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "recipeUpdated");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to recipe updated events"
  );

  try {
    for await (const data of calendarEmitter.createSubscription(eventName, signal)) {
      yield data as CalendarSubscriptionEvents["recipeUpdated"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from recipe updated events"
    );
  }
});

const onNotePlanned = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "notePlanned");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to note planned events"
  );

  try {
    for await (const data of calendarEmitter.createSubscription(eventName, signal)) {
      yield data as CalendarSubscriptionEvents["notePlanned"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from note planned events"
    );
  }
});

const onNoteDeleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "noteDeleted");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to note deleted events"
  );

  try {
    for await (const data of calendarEmitter.createSubscription(eventName, signal)) {
      yield data as CalendarSubscriptionEvents["noteDeleted"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from note deleted events"
    );
  }
});

const onNoteUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "noteUpdated");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to note updated events"
  );

  try {
    for await (const data of calendarEmitter.createSubscription(eventName, signal)) {
      yield data as CalendarSubscriptionEvents["noteUpdated"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from note updated events"
    );
  }
});

const onFailed = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = calendarEmitter.householdEvent(ctx.householdKey, "failed");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to calendar failed events"
  );

  try {
    for await (const data of calendarEmitter.createSubscription(eventName, signal)) {
      yield data as CalendarSubscriptionEvents["failed"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from calendar failed events"
    );
  }
});

export const calendarSubscriptions = router({
  onRecipePlanned,
  onRecipeDeleted,
  onRecipeUpdated,
  onNotePlanned,
  onNoteDeleted,
  onNoteUpdated,
  onFailed,
});
