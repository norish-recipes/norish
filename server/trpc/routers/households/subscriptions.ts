import type { HouseholdSubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { householdEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

/**
 * Subscription for household creation events.
 * User-scoped: only the user who created/joined the household receives this.
 */
const onCreated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "created");

  log.debug({ userId: ctx.user.id }, "Subscribed to household created events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["created"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from household created events");
  }
});

/**
 * Subscription for when the current user is kicked.
 * User-scoped: only the kicked user receives this.
 */
const onKicked = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "userKicked");

  log.debug({ userId: ctx.user.id }, "Subscribed to user kicked events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["userKicked"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from user kicked events");
  }
});

/**
 * Subscription for user-scoped failure events.
 */
const onFailed = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "failed");

  log.debug({ userId: ctx.user.id }, "Subscribed to household failed events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["failed"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from household failed events");
  }
});

/**
 * Subscription for when a user joins the household.
 * Household-scoped: all household members receive this.
 */
const onUserJoined = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // Only subscribe if user is in a household
  if (!ctx.household) {
    log.debug({ userId: ctx.user.id }, "No household, skipping userJoined subscription");

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "userJoined");

  log.debug(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to user joined events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["userJoined"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from user joined events");
  }
});

/**
 * Subscription for when a user leaves the household.
 * User-scoped for remaining members (emitted to each member individually).
 */
const onUserLeft = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = householdEmitter.userEvent(ctx.user.id, "userLeft");

  log.debug({ userId: ctx.user.id }, "Subscribed to user left events");

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["userLeft"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from user left events");
  }
});

/**
 * Subscription for when a member is removed (kicked).
 * Household-scoped: remaining members receive this.
 */
const onMemberRemoved = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // Only subscribe if user is in a household
  if (!ctx.household) {
    log.debug({ userId: ctx.user.id }, "No household, skipping memberRemoved subscription");

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "memberRemoved");

  log.debug(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to member removed events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["memberRemoved"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from member removed events");
  }
});

/**
 * Subscription for admin transfer events.
 * Household-scoped: all household members receive this.
 */
const onAdminTransferred = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // Only subscribe if user is in a household
  if (!ctx.household) {
    log.debug({ userId: ctx.user.id }, "No household, skipping adminTransferred subscription");

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "adminTransferred");

  log.debug(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to admin transferred events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["adminTransferred"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from admin transferred events");
  }
});

/**
 * Subscription for join code regeneration events.
 * Household-scoped: all household members receive this (only admin sees the code).
 */
const onJoinCodeRegenerated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // Only subscribe if user is in a household
  if (!ctx.household) {
    log.debug({ userId: ctx.user.id }, "No household, skipping joinCodeRegenerated subscription");

    return;
  }

  const eventName = householdEmitter.householdEvent(ctx.household.id, "joinCodeRegenerated");

  log.debug(
    { userId: ctx.user.id, householdId: ctx.household.id },
    "Subscribed to join code regenerated events"
  );

  try {
    for await (const data of householdEmitter.createSubscription(eventName, signal)) {
      yield data as HouseholdSubscriptionEvents["joinCodeRegenerated"];
    }
  } finally {
    log.debug({ userId: ctx.user.id }, "Unsubscribed from join code regenerated events");
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
});
