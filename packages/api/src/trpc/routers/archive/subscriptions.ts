import type { RecipeSubscriptionEvents } from "../recipes/types";
import { createSubscriptionIterable } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { recipeEmitter } from "../recipes/emitter";

/**
 * Archive import subscriptions
 */
const onArchiveProgress = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = recipeEmitter.userEvent(userId, "archiveProgress");

  for await (const data of createSubscriptionIterable(
    recipeEmitter,
    ctx.multiplexer,
    eventName,
    signal
  )) {
    yield data as RecipeSubscriptionEvents["archiveProgress"];
  }
});

const onArchiveCompleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = recipeEmitter.userEvent(userId, "archiveCompleted");

  for await (const data of createSubscriptionIterable(
    recipeEmitter,
    ctx.multiplexer,
    eventName,
    signal
  )) {
    yield data as RecipeSubscriptionEvents["archiveCompleted"];
  }
});

export const archiveSubscriptions = router({
  onArchiveProgress,
  onArchiveCompleted,
});
