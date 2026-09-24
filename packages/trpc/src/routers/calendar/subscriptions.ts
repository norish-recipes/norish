import { calendar } from "@norish/shared-server/realtime/calendar";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const calendarSubscriptions = router({
  onFailed: realtimeSubscription(calendar, "failed"),
  onItemCreated: realtimeSubscription(calendar, "itemCreated"),
  onItemDeleted: realtimeSubscription(calendar, "itemDeleted"),
  onItemMoved: realtimeSubscription(calendar, "itemMoved"),
  onItemUpdated: realtimeSubscription(calendar, "itemUpdated"),
});
