/** Mock for @norish/shared-server/realtime/ingredients */
import { ingredientsRealtime } from "@norish/shared/contracts/realtime/ingredients";

import { createFakeRealtimeDomain } from "../realtime";

export const ingredients = createFakeRealtimeDomain(ingredientsRealtime);
