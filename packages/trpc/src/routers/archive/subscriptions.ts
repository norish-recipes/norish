import { archive } from "@norish/shared-server/realtime/archive";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const archiveSubscriptions = router({
  onArchiveProgress: realtimeSubscription(archive, "archiveProgress"),
  onArchiveCompleted: realtimeSubscription(archive, "archiveCompleted"),
});
