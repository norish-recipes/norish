import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { ratingsRealtime } from "@norish/shared/contracts/realtime/ratings";

export const ratings = defineRealtimeDomain(ratingsRealtime);
