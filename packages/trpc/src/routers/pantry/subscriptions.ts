import { pantry } from "@norish/shared-server/realtime/pantry";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const pantrySubscriptions = router({
  onAdded: realtimeSubscription(pantry, "added"),
  onRemoved: realtimeSubscription(pantry, "removed"),
});
