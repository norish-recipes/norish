import { router } from "../../trpc";

import { permissionsProcedures } from "./permissions";
import { permissionsSubscriptions } from "./subscriptions";

export { permissionsEmitter } from "./emitter";
export type { PermissionsSubscriptionEvents } from "./types";

export const permissionsRouter = router({
  ...permissionsProcedures._def.procedures,
  ...permissionsSubscriptions._def.procedures,
});
