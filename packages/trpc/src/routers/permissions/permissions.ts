import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import { isUserServerAdmin } from "@norish/db";
import {
  getRecipePermissionPolicy,
  isAIEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting permissions");

  const [recipePolicy, aiEnabled, serverAdmin] = await Promise.all([
    getRecipePermissionPolicy() as Promise<RecipePermissionPolicy>,
    isAIEnabled(),
    isUserServerAdmin(ctx.user.id),
  ]);

  return {
    recipePolicy,
    isAIEnabled: aiEnabled,
    householdUserIds: ctx.householdUserIds,
    isServerAdmin: serverAdmin,
  };
});

export const permissionsProcedures = router({
  get,
});
