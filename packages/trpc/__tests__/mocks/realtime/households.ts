/** Mock for @norish/shared-server/realtime/households */
import { householdsRealtime } from "@norish/shared/contracts/realtime/households";

import { createFakeRealtimeDomain } from "../realtime";

export const households = createFakeRealtimeDomain(householdsRealtime);
