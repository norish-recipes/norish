import { useTRPC } from "@/lib/trpc/trpc-provider";

import { createRecipeHooks } from "@norish/shared-react/hooks";

const sharedRecipeHooks = createRecipeHooks({ useTRPC });

export const sharedDashboardRecipeHooks = sharedRecipeHooks.dashboard;
