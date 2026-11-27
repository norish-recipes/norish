import { RecipePermissionPolicySchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { setConfig } from "@norish/db/repositories/server-config";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { permissions } from "@norish/shared-server/realtime/permissions";
import { bumpViewEpoch } from "@norish/shared-server/realtime/resume";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/** Sets the Permission Policy; one whose edit or delete reaches further than view is refused. */
const updateRecipePermissionPolicy = adminProcedure
  .input(RecipePermissionPolicySchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, policy: input }, "Updating recipe permission policy");

    await setConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY, input, ctx.user.id, false);
    await bumpViewEpoch();

    log.info({ recipePolicy: input }, "Broadcasting permission policy update");
    void permissions.publish("policyUpdated", { recipePolicy: input }, undefined);

    return { success: true };
  });

export const permissionsProcedures = router({
  updateRecipePermissionPolicy,
});
