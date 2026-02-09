import { router } from "../../trpc";

import { adminConfigProcedures } from "./config";
import { generalProcedures } from "./general";
import { authProvidersProcedures } from "./auth-providers";
import { contentConfigProcedures } from "./content-config";
import { aiConfigProcedures } from "./ai-config";
import { permissionsProcedures } from "./permissions";
import { systemProcedures } from "./system";

export const adminRouter = router({
  // Config queries
  ...adminConfigProcedures._def.procedures,

  // General (registration, locale config)
  ...generalProcedures._def.procedures,

  // Auth providers
  auth: authProvidersProcedures,

  // Content config (indicators, units, recurrence)
  content: contentConfigProcedures,

  // AI and video
  ...aiConfigProcedures._def.procedures,

  // Permissions (recipe policy)
  ...permissionsProcedures._def.procedures,

  // System (scheduler, restart, restore)
  ...systemProcedures._def.procedures,
});
