/** Mock for @norish/shared-server/realtime/caldav */
import { caldavRealtime } from "@norish/shared/contracts/realtime/caldav";

import { createFakeRealtimeDomain } from "../realtime";

export const caldav = createFakeRealtimeDomain(caldavRealtime);
