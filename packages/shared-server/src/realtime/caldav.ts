import { z } from "zod";

import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import { createTypedEmitter } from "@norish/shared-server/redis/pubsub";
import {
  CaldavConfigSavedEventSchema,
  CaldavInitialSyncCompleteEventSchema,
  CaldavItemStatusUpdatedEventSchema,
  CaldavSyncCompletedEventSchema,
  CaldavSyncFailedEventSchema,
  CaldavSyncStartedEventSchema,
} from "@norish/shared/contracts/zod";

export type CaldavSubscriptionEvents = {
  configSaved: z.infer<typeof CaldavConfigSavedEventSchema>;
  syncStarted: z.infer<typeof CaldavSyncStartedEventSchema>;
  syncCompleted: z.infer<typeof CaldavSyncCompletedEventSchema>;
  syncFailed: z.infer<typeof CaldavSyncFailedEventSchema>;
  itemStatusUpdated: z.infer<typeof CaldavItemStatusUpdatedEventSchema>;
  initialSyncComplete: z.infer<typeof CaldavInitialSyncCompleteEventSchema>;
};

declare global {
  var __caldavEmitter__: TypedRedisEmitter<CaldavSubscriptionEvents> | undefined;
}

export const caldavEmitter: TypedRedisEmitter<CaldavSubscriptionEvents> =
  globalThis.__caldavEmitter__ ||
  (globalThis.__caldavEmitter__ = createTypedEmitter<CaldavSubscriptionEvents>("caldav"));
