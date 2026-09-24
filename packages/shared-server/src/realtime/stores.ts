import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { storesRealtime } from "@norish/shared/contracts/realtime/stores";

export const stores = defineRealtimeDomain(storesRealtime);
