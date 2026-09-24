/** Mock for @norish/shared-server/realtime/groceries */
import { groceriesRealtime } from "@norish/shared/contracts/realtime/groceries";

import { createFakeRealtimeDomain } from "../realtime";

export const groceries = createFakeRealtimeDomain(groceriesRealtime);
