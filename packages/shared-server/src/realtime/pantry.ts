import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import { createTypedEmitter } from "@norish/shared-server/redis/pubsub";

export type PantrySubscriptionEvents = {
  /** A name put in the Pantry; merged by id, so a repeat changes nothing. */
  added: { item: PantryIngredientDto };
  /** A name taken out of the Pantry; filtered by id, so a repeat changes nothing. */
  removed: { itemId: string };
};

declare global {
  var __pantryEmitter__: TypedRedisEmitter<PantrySubscriptionEvents> | undefined;
}

export const pantryEmitter: TypedRedisEmitter<PantrySubscriptionEvents> =
  globalThis.__pantryEmitter__ ||
  (globalThis.__pantryEmitter__ = createTypedEmitter<PantrySubscriptionEvents>("pantry"));
