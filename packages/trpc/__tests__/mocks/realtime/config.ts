/** Mock for @norish/shared-server/realtime/config */
import { configRealtime } from "@norish/shared/contracts/realtime/config";

import { createFakeRealtimeDomain } from "../realtime";

export const config = createFakeRealtimeDomain(configRealtime);
