/** Mock for @norish/shared-server/realtime/permissions */
import { permissionsRealtime } from "@norish/shared/contracts/realtime/permissions";

import { createFakeRealtimeDomain } from "../realtime";

export const permissions = createFakeRealtimeDomain(permissionsRealtime);
