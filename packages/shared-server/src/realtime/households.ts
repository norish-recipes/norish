import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { householdsRealtime } from "@norish/shared/contracts/realtime/households";

export const households = defineRealtimeDomain(householdsRealtime);
