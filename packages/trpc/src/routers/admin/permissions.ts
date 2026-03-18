import { RecipePermissionPolicySchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { setConfig } from "@norish/db/repositories/server-config";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";
import { permissionsEmitter } from "../permissions/emitter";

/**
 * Update recipe permission policy.
 */
const updateRecipePermissionPolicy = adminProcedure
  .input(RecipePermissionPolicySchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, policy: input }, "Updating recipe permission policy");

    await setConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY, input, ctx.user.id, false);

    log.info({ recipePolicy: input }, "Broadcasting permission policy update");
    permissionsEmitter.broadcast("policyUpdated", { recipePolicy: input });

    return { success: true };
  });

export const permissionsProcedures = router({
  updateRecipePermissionPolicy,
});
