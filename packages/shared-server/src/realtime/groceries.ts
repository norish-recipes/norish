import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import { createTypedEmitter } from "@norish/shared-server/redis/pubsub";

export type GrocerySubscriptionEvents = {
  created: { groceries: GroceryDto[] };
  updated: { changedGroceries: GroceryDto[] };
  deleted: { groceryIds: string[] };
  recurringCreated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringUpdated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringDeleted: { recurringGroceryId: string };
  failed: { reason: string };
};

declare global {
  var __groceryEmitter__: TypedRedisEmitter<GrocerySubscriptionEvents> | undefined;
}

export const groceryEmitter: TypedRedisEmitter<GrocerySubscriptionEvents> =
  globalThis.__groceryEmitter__ ||
  (globalThis.__groceryEmitter__ = createTypedEmitter<GrocerySubscriptionEvents>("grocery"));
