import type { RecipeSubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { mergeAsyncIterables, createPolicyAwareIterables } from "../../helpers";

import { recipeEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

/**
 * Helper to create a policy-aware subscription that listens to all three event channels
 */
function createPolicyAwareSubscription<K extends keyof RecipeSubscriptionEvents & string>(
  eventName: K,
  logMessage: string
) {
  return authedProcedure.subscription(async function* ({ ctx, signal }) {
    const policyCtx = { userId: ctx.user.id, householdKey: ctx.householdKey };

    log.debug(
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      `Subscribed to ${logMessage}`
    );

    try {
      const iterables = createPolicyAwareIterables(recipeEmitter, policyCtx, eventName, signal);

      for await (const data of mergeAsyncIterables(iterables, signal)) {
        yield data as RecipeSubscriptionEvents[K];
      }
    } finally {
      log.debug(
        { userId: ctx.user.id, householdKey: ctx.householdKey },
        `Unsubscribed from ${logMessage}`
      );
    }
  });
}

const onCreated = createPolicyAwareSubscription("created", "recipe created events");
const onImportStarted = createPolicyAwareSubscription(
  "importStarted",
  "recipe import started events"
);
const onImported = createPolicyAwareSubscription("imported", "recipe imported events");
const onUpdated = createPolicyAwareSubscription("updated", "recipe updated events");
const onDeleted = createPolicyAwareSubscription("deleted", "recipe deleted events");
const onConverted = createPolicyAwareSubscription("converted", "recipe converted events");
const onFailed = createPolicyAwareSubscription("failed", "recipe failed events");
const onRecipeBatchCreated = createPolicyAwareSubscription(
  "recipeBatchCreated",
  "recipe batch created events"
);

export const recipesSubscriptions = router({
  onCreated,
  onImportStarted,
  onImported,
  onUpdated,
  onDeleted,
  onConverted,
  onFailed,
  onRecipeBatchCreated,
});
