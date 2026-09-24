import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { caldavRealtime } from "@norish/shared/contracts/realtime/caldav";

export const caldav = defineRealtimeDomain(caldavRealtime);
