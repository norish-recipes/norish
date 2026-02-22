import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import {
  getRecipePermissionPolicy,
  isAIEnabled,
  getAutoTaggingMode,
} from "@norish/config/server-config-loader";
import { isUserServerAdmin } from "@/server/db";

const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting permissions");

  const [recipePolicy, aiEnabled, serverAdmin, autoTaggingMode] = await Promise.all([
    getRecipePermissionPolicy(),
    isAIEnabled(),
    isUserServerAdmin(ctx.user.id),
    getAutoTaggingMode(),
  ]);

  return {
    recipePolicy,
    isAIEnabled: aiEnabled,
    householdUserIds: ctx.householdUserIds,
    isServerAdmin: serverAdmin,
    autoTaggingMode,
  };
});

export const permissionsProcedures = router({
  get,
});
