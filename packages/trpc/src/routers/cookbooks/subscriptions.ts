import { cookbooks } from "@norish/shared-server/realtime/cookbooks";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const cookbooksSubscriptions = router({
  onCreated: realtimeSubscription(cookbooks, "created"),
  onUpdated: realtimeSubscription(cookbooks, "updated"),
  onDeleted: realtimeSubscription(cookbooks, "deleted"),
  onMembershipChanged: realtimeSubscription(cookbooks, "membershipChanged"),
});
