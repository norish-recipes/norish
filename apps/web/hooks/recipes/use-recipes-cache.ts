"use client";

import type { InfiniteRecipeData, RecipesCacheHelpers } from "@norish/shared-react/hooks";

import { sharedDashboardRecipeHooks } from "./shared-recipe-hooks";

export type { InfiniteRecipeData, RecipesCacheHelpers };

export const useRecipesCacheHelpers = sharedDashboardRecipeHooks.useRecipesCacheHelpers;
