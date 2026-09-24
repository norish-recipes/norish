import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { pantryRealtime } from "@norish/shared/contracts/realtime/pantry";

export const pantry = defineRealtimeDomain(pantryRealtime);
