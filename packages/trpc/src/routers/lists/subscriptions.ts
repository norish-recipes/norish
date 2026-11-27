import { lists } from "@norish/shared-server/realtime/lists";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const listsSubscriptions = router({
  onChanged: realtimeSubscription(lists, "changed"),
});
