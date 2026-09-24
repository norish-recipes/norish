/** Mock for @norish/shared-server/realtime/cookbooks */
import { cookbooksRealtime } from "@norish/shared/contracts/realtime/cookbooks";

import { createFakeRealtimeDomain } from "../realtime";

export const cookbooks = createFakeRealtimeDomain(cookbooksRealtime);
