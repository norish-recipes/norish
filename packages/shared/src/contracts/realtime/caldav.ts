/**
 * CalDAV realtime catalogue.
 *
 * CalDAV is configured per user, so everything is user-scoped. The six sync
 * facts travel as one `syncEvent` whose `type` discriminates them: the client
 * keeps a single subscription and the wire shape `{ type, data }` it already
 * reads.
 */

import { z } from "zod";

import {
  CaldavConfigSavedEventSchema,
  CaldavInitialSyncCompleteEventSchema,
  CaldavItemStatusUpdatedEventSchema,
  CaldavSyncCompletedEventSchema,
  CaldavSyncFailedEventSchema,
  CaldavSyncStartedEventSchema,
} from "@norish/shared/contracts/zod/caldav-config";

import { defineRealtimeCatalogue } from "./catalogue";

export const CaldavSyncEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("configSaved"), data: CaldavConfigSavedEventSchema }),
  z.object({ type: z.literal("syncStarted"), data: CaldavSyncStartedEventSchema }),
  z.object({ type: z.literal("syncCompleted"), data: CaldavSyncCompletedEventSchema }),
  z.object({ type: z.literal("syncFailed"), data: CaldavSyncFailedEventSchema }),
  z.object({ type: z.literal("itemStatusUpdated"), data: CaldavItemStatusUpdatedEventSchema }),
  z.object({ type: z.literal("initialSyncComplete"), data: CaldavInitialSyncCompleteEventSchema }),
]);

export type CaldavSyncEvent = z.infer<typeof CaldavSyncEventSchema>;

/** The `data` of each sync event, by its `type`. */
export type CaldavSyncEventData = {
  [E in CaldavSyncEvent as E["type"]]: E["data"];
};

export const caldavRealtime = defineRealtimeCatalogue("caldav", {
  syncEvent: { scope: "user", payload: CaldavSyncEventSchema },
});

export type CaldavRealtime = typeof caldavRealtime;
