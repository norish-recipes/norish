import type { RecipeSubscriptionEvents } from "../recipes/types";

import { authedProcedure } from "../../middleware";
import { recipeEmitter } from "../recipes/emitter";
import { router } from "../../trpc";

/**
 * Archive import subscriptions
 */
const onArchiveProgress = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = recipeEmitter.userEvent(userId, "archiveProgress");

  for await (const data of recipeEmitter.createSubscription(eventName, signal)) {
    yield data as RecipeSubscriptionEvents["archiveProgress"];
  }
});

const onArchiveCompleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = recipeEmitter.userEvent(userId, "archiveCompleted");

  for await (const data of recipeEmitter.createSubscription(eventName, signal)) {
    yield data as RecipeSubscriptionEvents["archiveCompleted"];
  }
});

export const archiveSubscriptions = router({
  onArchiveProgress,
  onArchiveCompleted,
});

