import { router } from "../../trpc";
import { aiConfigProcedures } from "./ai-config";
import { authProvidersProcedures } from "./auth-providers";
import { adminConfigProcedures } from "./config";
import { contentConfigProcedures } from "./content-config";
import { cuisinesProcedures } from "./cuisines";
import { generalProcedures } from "./general";
import { jobQueueProcedures } from "./job-queue";
import { permissionsProcedures } from "./permissions";
import { systemProcedures } from "./system";
import { videoRuntimeProcedures } from "./video-runtime";

export const adminRouter = router({
  // Config queries
  ...adminConfigProcedures._def.procedures,

  // General (registration, locale config)
  ...generalProcedures._def.procedures,

  // Auth providers
  auth: authProvidersProcedures,

  // Content config (indicators, units, recurrence)
  content: contentConfigProcedures,

  // Cuisine vocabulary governance; the list itself is read from `config.cuisines`
  cuisines: cuisinesProcedures,

  // Job queue monitoring
  jobs: jobQueueProcedures,

  // AI and video
  ...aiConfigProcedures._def.procedures,

  // What the downloader binary actually is, as opposed to what is configured
  ...videoRuntimeProcedures._def.procedures,

  // Permissions (recipe policy)
  ...permissionsProcedures._def.procedures,

  // System (scheduler, restart, restore)
  ...systemProcedures._def.procedures,
});
