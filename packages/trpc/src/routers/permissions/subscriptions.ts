import { permissions } from "@norish/shared-server/realtime/permissions";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const permissionsSubscriptions = router({
  onPolicyUpdated: realtimeSubscription(permissions, "policyUpdated"),
});
