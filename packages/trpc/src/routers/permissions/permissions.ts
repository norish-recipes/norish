import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import {
  getAutoTaggingMode,
  getRecipePermissionPolicy,
  isAIEnabled,
} from "@norish/config/server-config-loader";
import { isUserServerAdmin } from "@norish/db";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting permissions");

  const [recipePolicy, aiEnabled, serverAdmin, autoTaggingMode] = await Promise.all([
    getRecipePermissionPolicy() as Promise<RecipePermissionPolicy>,
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
