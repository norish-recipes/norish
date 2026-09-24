/**
 * CalDAV tRPC Subscriptions
 *
 * One subscription carries every sync fact; the payload's `type` says which.
 */

import { caldav } from "@norish/shared-server/realtime/caldav";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const caldavSubscriptions = router({
  onSyncEvent: realtimeSubscription(caldav, "syncEvent"),
});

export type CaldavSubscriptionsRouter = typeof caldavSubscriptions;
