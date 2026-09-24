import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { archiveRealtime } from "@norish/shared/contracts/realtime/archive";

export const archive = defineRealtimeDomain(archiveRealtime);
