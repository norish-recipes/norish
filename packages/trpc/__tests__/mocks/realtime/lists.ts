/** Mock for @norish/shared-server/realtime/lists */
import { listsRealtime } from "@norish/shared/contracts/realtime/lists";

import { createFakeRealtimeDomain } from "../realtime";

export const lists = createFakeRealtimeDomain(listsRealtime);
