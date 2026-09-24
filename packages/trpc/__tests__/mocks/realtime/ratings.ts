/** Mock for @norish/shared-server/realtime/ratings */
import { ratingsRealtime } from "@norish/shared/contracts/realtime/ratings";

import { createFakeRealtimeDomain } from "../realtime";

export const ratings = createFakeRealtimeDomain(ratingsRealtime);
