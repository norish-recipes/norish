import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { ingredientsRealtime } from "@norish/shared/contracts/realtime/ingredients";

export const ingredients = defineRealtimeDomain(ingredientsRealtime);
