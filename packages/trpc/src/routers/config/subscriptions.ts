import { config } from "@norish/shared-server/realtime/config";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const configSubscriptions = router({
  onChanged: realtimeSubscription(config, "changed"),
});
