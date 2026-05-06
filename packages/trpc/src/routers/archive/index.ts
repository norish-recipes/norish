import { router } from "../../trpc";

import { archiveRouter } from "./archive";
import { archiveSubscriptions } from "./subscriptions";

/**
 * Archive router, handles archive imports (Mela/Mealie/Tandoor)
 */
export const archive = router({
  ...archiveRouter._def.procedures,
  ...archiveSubscriptions._def.procedures,
});
