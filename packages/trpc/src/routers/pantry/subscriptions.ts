import { trpcLogger as log } from "@norish/shared-server/logger";

import type { PantrySubscriptionEvents } from "./types";
import { createSubscriptionIterable } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { pantryEmitter } from "./emitter";

const onAdded = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = pantryEmitter.householdEvent(ctx.householdKey, "added");

  try {
    for await (const data of createSubscriptionIterable(
      pantryEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as PantrySubscriptionEvents["added"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from pantry added events"
    );
  }
});

const onRemoved = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = pantryEmitter.householdEvent(ctx.householdKey, "removed");

  try {
    for await (const data of createSubscriptionIterable(
      pantryEmitter,
      ctx.multiplexer,
      eventName,
      signal
    )) {
      yield data as PantrySubscriptionEvents["removed"];
    }
  } finally {
    log.trace(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "Unsubscribed from pantry removed events"
    );
  }
});

export const pantrySubscriptions = router({
  onAdded,
  onRemoved,
});
