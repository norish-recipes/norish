import {
  IngredientPermissionPolicySchema,
  RecipePermissionPolicySchema,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import { setConfig } from "@norish/db/repositories/server-config";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { ingredients } from "@norish/shared-server/realtime/ingredients";
import { permissions } from "@norish/shared-server/realtime/permissions";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Update recipe permission policy.
 */
const updateRecipePermissionPolicy = adminProcedure
  .input(RecipePermissionPolicySchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, policy: input }, "Updating recipe permission policy");

    await setConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY, input, ctx.user.id, false);

    log.info({ recipePolicy: input }, "Broadcasting permission policy update");
    void permissions.publish("policyUpdated", { recipePolicy: input }, undefined);

    return { success: true };
  });

/**
 * Update who may edit an Ingredient someone else minted. The Ingredients
 * page reads what a viewer may do with every list, so the change is
 * announced as an Ingredient change about no Ingredient in particular: every
 * open page lists again and offers what the new policy allows.
 */
const updateIngredientPermissionPolicy = adminProcedure
  .input(IngredientPermissionPolicySchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, policy: input }, "Updating ingredient permission policy");

    await setConfig(ServerConfigKeys.INGREDIENT_PERMISSION_POLICY, input, ctx.user.id, false);
    void ingredients.publish("changed", { ingredientIds: [] }, undefined);

    return { success: true };
  });

export const permissionsProcedures = router({
  updateRecipePermissionPolicy,
  updateIngredientPermissionPolicy,
});
