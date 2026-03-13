import type { CreateRecipeHooksOptions } from "./types";

import { createDashboardRecipeHooks } from "./dashboard";
import { createRecipeFamilyHooks } from "./recipe";

export type { CreateRecipeHooksOptions } from "./types";

export * from "./dashboard";
export * from "./recipe";

export function createRecipeHooks(options: CreateRecipeHooksOptions) {
  const recipe = createRecipeFamilyHooks(options);
  const dashboard = createDashboardRecipeHooks(options, {
    useAutoTaggingQuery: recipe.useAutoTaggingQuery,
    useAllergyDetectionQuery: recipe.useAllergyDetectionQuery,
  });

  return {
    dashboard,
    recipe,
  };
}
