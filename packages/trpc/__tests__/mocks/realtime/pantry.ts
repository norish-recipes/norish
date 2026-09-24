/** Mock for @norish/shared-server/realtime/pantry */
import { pantryRealtime } from "@norish/shared/contracts/realtime/pantry";

import { createFakeRealtimeDomain } from "../realtime";

export const pantry = createFakeRealtimeDomain(pantryRealtime);
