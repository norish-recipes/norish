import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { listsRealtime } from "@norish/shared/contracts/realtime/lists";

export const lists = defineRealtimeDomain(listsRealtime);
