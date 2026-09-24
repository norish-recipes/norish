/** Mock for @norish/shared-server/realtime/archive */
import { archiveRealtime } from "@norish/shared/contracts/realtime/archive";

import { createFakeRealtimeDomain } from "../realtime";

export const archive = createFakeRealtimeDomain(archiveRealtime);
