/** Mock for @norish/shared-server/realtime/recipes */
import { recipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import { createFakeRealtimeDomain } from "../realtime";

export const recipes = createFakeRealtimeDomain(recipesRealtime);
