import { households } from "@norish/shared-server/realtime/households";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

// A household-less user's household channel is `household:{userId}` and simply
// stays quiet; no subscription needs to wait for a household to exist.
export const householdSubscriptionsRouter = router({
  onCreated: realtimeSubscription(households, "created"),
  onKicked: realtimeSubscription(households, "userKicked"),
  onFailed: realtimeSubscription(households, "failed"),
  onUserJoined: realtimeSubscription(households, "userJoined"),
  onUserLeft: realtimeSubscription(households, "userLeft"),
  onMemberRemoved: realtimeSubscription(households, "memberRemoved"),
  onAdminTransferred: realtimeSubscription(households, "adminTransferred"),
  onJoinCodeRegenerated: realtimeSubscription(households, "joinCodeRegenerated"),
  onAllergiesUpdated: realtimeSubscription(households, "allergiesUpdated"),
  onMemberProfileUpdated: realtimeSubscription(households, "memberProfileUpdated"),
});
