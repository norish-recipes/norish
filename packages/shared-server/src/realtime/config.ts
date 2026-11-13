import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { configRealtime } from "@norish/shared/contracts/realtime/config";

export const config = defineRealtimeDomain(configRealtime);
