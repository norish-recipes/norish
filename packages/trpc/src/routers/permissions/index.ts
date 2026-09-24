import { router } from "../../trpc";
import { permissionsProcedures } from "./permissions";
import { permissionsSubscriptions } from "./subscriptions";

export const permissionsRouter = router({
  ...permissionsProcedures._def.procedures,
  ...permissionsSubscriptions._def.procedures,
});
