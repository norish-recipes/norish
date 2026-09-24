import { stores } from "@norish/shared-server/realtime/stores";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const storesSubscriptions = router({
  onCreated: realtimeSubscription(stores, "created"),
  onUpdated: realtimeSubscription(stores, "updated"),
  onDeleted: realtimeSubscription(stores, "deleted"),
  onReordered: realtimeSubscription(stores, "reordered"),
  onProductUpdated: realtimeSubscription(stores, "productUpdated"),
  onLinkUpdated: realtimeSubscription(stores, "linkUpdated"),
  onAisleFiled: realtimeSubscription(stores, "aisleFiled"),
});
