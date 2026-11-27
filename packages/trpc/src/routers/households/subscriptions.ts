import { households } from "@norish/shared-server/realtime/households";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

// Every account is in a household, so every subscription listens on its household's channel.
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
