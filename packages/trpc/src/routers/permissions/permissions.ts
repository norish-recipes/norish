import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import { isUserServerAdmin } from "@norish/db";
import {
  getAutoTaggingMode,
  getRecipePermissionPolicy,
  isAIEnabled,
  isProvenanceEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting permissions");

  const [recipePolicy, aiEnabled, provenanceEnabled, serverAdmin, autoTaggingMode] = await Promise.all([
    getRecipePermissionPolicy() as Promise<RecipePermissionPolicy>,
    isAIEnabled(),
    isProvenanceEnabled(),
    isUserServerAdmin(ctx.user.id),
    getAutoTaggingMode(),
  ]);

  return {
    recipePolicy,
    isAIEnabled: aiEnabled,
    isProvenanceEnabled: provenanceEnabled,
    householdUserIds: ctx.householdUserIds,
    isServerAdmin: serverAdmin,
    autoTaggingMode,
  };
});

export const permissionsProcedures = router({
  get,
});
