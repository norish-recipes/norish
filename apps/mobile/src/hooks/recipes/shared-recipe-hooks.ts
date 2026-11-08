import { createRecipeHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

const sharedRecipeHooks = createRecipeHooks({ useTRPC });

export const sharedDashboardRecipeHooks = sharedRecipeHooks.dashboard;
