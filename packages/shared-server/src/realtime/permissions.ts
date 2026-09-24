import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { permissionsRealtime } from "@norish/shared/contracts/realtime/permissions";

export const permissions = defineRealtimeDomain(permissionsRealtime);
