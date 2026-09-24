/** Mock for @norish/shared-server/realtime/stores */
import { storesRealtime } from "@norish/shared/contracts/realtime/stores";

import { createFakeRealtimeDomain } from "../realtime";

export const stores = createFakeRealtimeDomain(storesRealtime);
