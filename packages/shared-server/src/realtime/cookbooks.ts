import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { cookbooksRealtime } from "@norish/shared/contracts/realtime/cookbooks";

export const cookbooks = defineRealtimeDomain(cookbooksRealtime);
