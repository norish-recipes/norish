import { useTRPC } from "@/providers/trpc-provider";

import { createRecipeHooks } from "@norish/shared-react/hooks";

const sharedRecipeHooks = createRecipeHooks({ useTRPC });

export const sharedDashboardRecipeHooks = sharedRecipeHooks.dashboard;
export const sharedRecipeFamilyHooks = sharedRecipeHooks.recipe;
export const sharedRecipeShareHooks = sharedRecipeHooks.shares;
