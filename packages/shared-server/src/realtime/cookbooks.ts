import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { createTypedEmitter } from "@norish/shared-server/redis/pubsub";

/**
 * Cookbook lifecycle events.
 *
 * These broadcast without echo suppression, following recipes rather than
 * groceries: suppression exists only where the actor already holds the change
 * locally, and a cookbook's viewer-scoped member count and derived cover are
 * computed server-side, so the actor wants its own echo too.
 */
export type CookbookSubscriptionEvents = {
  created: { cookbook: CookbookSummaryDTO };
  updated: { cookbook: CookbookSummaryDTO };
  deleted: { id: string };
  /** A recipe was filed into, or taken out of, a cookbook. */
  membershipChanged: { cookbookId: string; recipeId: string; isMember: boolean };
};

declare global {
  var __cookbookEmitter__: TypedRedisEmitter<CookbookSubscriptionEvents> | undefined;
}

export const cookbookEmitter: TypedRedisEmitter<CookbookSubscriptionEvents> =
  globalThis.__cookbookEmitter__ ||
  (globalThis.__cookbookEmitter__ = createTypedEmitter<CookbookSubscriptionEvents>("cookbook"));
