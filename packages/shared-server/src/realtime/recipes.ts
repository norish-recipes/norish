import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { recipesRealtime } from "@norish/shared/contracts/realtime/recipes";

export const recipes = defineRealtimeDomain(recipesRealtime);
