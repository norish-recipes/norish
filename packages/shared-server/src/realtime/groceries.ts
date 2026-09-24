import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { groceriesRealtime } from "@norish/shared/contracts/realtime/groceries";

export const groceries = defineRealtimeDomain(groceriesRealtime);
