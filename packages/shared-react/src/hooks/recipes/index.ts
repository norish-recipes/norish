import type { CreateRecipeHooksOptions } from "./types";
import { createDashboardRecipeHooks } from "./dashboard";
import { createRecipeFamilyHooks } from "./recipe";
import { createRecipeShareHooks } from "./shares";

export type { CreateRecipeHooksOptions } from "./types";

export * from "./dashboard";
export * from "./recipe";
export * from "./shares";

export function createRecipeHooks(options: CreateRecipeHooksOptions) {
  const recipe = createRecipeFamilyHooks(options);
  const dashboard = createDashboardRecipeHooks(options, {
    useAutoTaggingQuery: recipe.useAutoTaggingQuery,
    useAllergyDetectionQuery: recipe.useAllergyDetectionQuery,
  });
  const shares = createRecipeShareHooks(options);

  return {
    dashboard,
    recipe,
    shares,
  };
}
