import { groceries } from "@norish/shared-server/realtime/groceries";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const groceriesSubscriptions = router({
  onCreated: realtimeSubscription(groceries, "created"),
  onUpdated: realtimeSubscription(groceries, "updated"),
  onDeleted: realtimeSubscription(groceries, "deleted"),
  onRecurringCreated: realtimeSubscription(groceries, "recurringCreated"),
  onRecurringUpdated: realtimeSubscription(groceries, "recurringUpdated"),
  onRecurringDeleted: realtimeSubscription(groceries, "recurringDeleted"),
  onFailed: realtimeSubscription(groceries, "failed"),
  onStale: realtimeSubscription(groceries, "stale"),
});
