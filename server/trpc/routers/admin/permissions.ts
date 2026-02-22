import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";
import { permissionsEmitter } from "../permissions/emitter";

import { trpcLogger as log } from "@/server/logger";
import { setConfig } from "@/server/db/repositories/server-config";
import {
  ServerConfigKeys,
  RecipePermissionPolicySchema,
} from "@norish/config/zod/server-config";

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
