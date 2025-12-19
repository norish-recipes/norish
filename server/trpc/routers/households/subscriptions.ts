import type { HouseholdSubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { waitForAbort } from "../../helpers";

import { householdEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

/**
 * Subscription for household creation events.
 * User-scoped: only the user who created/joined the household receives this.
 */
const onCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "created");

  log.trace({ userId: ctx.user.id }, "Subscribed to household created events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["created"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from household created events");
  }
});

/**
 * Subscription for when the current user is kicked.
 * User-scoped: only the kicked user receives this.
 */
const onKicked = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "userKicked");

  log.trace({ userId: ctx.user.id }, "Subscribed to user kicked events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["userKicked"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from user kicked events");
  }
});

/**
 * Subscription for user-scoped failure events.
 */
const onFailed = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "failed");

  log.trace({ userId: ctx.user.id }, "Subscribed to household failed events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["failed"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from household failed events");
  }
});

/**
 * Subscription for when a user joins the household.
 * Household-scoped: all household members receive this.
 */
const onUserJoined = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // If no household, wait for connection to be closed (will restart on reconnect)
  if (!ctx.household) {
    log.trace({ userId: ctx.user.id }, "No household, waiting for reconnection");
    await waitForAbort(signal);

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "userJoined");

  log.trace(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to user joined events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["userJoined"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from user joined events");
  }
});

/**
 * Subscription for when a user leaves the household.
 * User-scoped for remaining members (emitted to each member individually).
 */
const onUserLeft = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "userLeft");

  log.trace({ userId: ctx.user.id }, "Subscribed to user left events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["userLeft"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from user left events");
  }
});

/**
 * Subscription for when a member is removed (kicked).
 * Household-scoped: remaining members receive this.
 */
const onMemberRemoved = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // If no household, wait for connection to be closed (will restart on reconnect)
  if (!ctx.household) {
    log.trace({ userId: ctx.user.id }, "No household, waiting for reconnection");
    await waitForAbort(signal);

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "memberRemoved");

  log.trace(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to member removed events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["memberRemoved"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from member removed events");
  }
});

/**
 * Subscription for admin transfer events.
 * Household-scoped: all household members receive this.
 */
const onAdminTransferred = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // If no household, wait for connection to be closed (will restart on reconnect)
  if (!ctx.household) {
    log.trace({ userId: ctx.user.id }, "No household, waiting for reconnection");
    await waitForAbort(signal);

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "adminTransferred");

  log.trace(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to admin transferred events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["adminTransferred"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from admin transferred events");
  }
});

/**
 * Subscription for join code regeneration events.
 * Household-scoped: all household members receive this (only admin sees the code).
 */
const onJoinCodeRegenerated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // If no household, wait for connection to be closed (will restart on reconnect)
  if (!ctx.household) {
    log.trace({ userId: ctx.user.id }, "No household, waiting for reconnection");
    await waitForAbort(signal);

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "joinCodeRegenerated");

  log.trace(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to join code regenerated events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["joinCodeRegenerated"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from join code regenerated events");
  }
});

const onAllergiesUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // If no household, wait for connection to be closed (will restart on reconnect)
  if (!ctx.household) {
    log.trace({ userId: ctx.user.id }, "No household, waiting for reconnection");
    await waitForAbort(signal);

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "allergiesUpdated");

  log.trace(
    { userId: ctx.user.id, householdId: ctx.household.id, eventName },
    "Subscribed to allergies updated events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      log.info({ data }, "Received allergiesUpdated event");
      yield data as HouseholdSubscriptionEvents["allergiesUpdated"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from allergies updated events");
  }
});

export const householdSubscriptionsRouter = router({
  onCreated,
  onKicked,
  onFailed,
  onUserJoined,
  onUserLeft,
  onMemberRemoved,
  onAdminTransferred,
  onJoinCodeRegenerated,
  onAllergiesUpdated,
});
