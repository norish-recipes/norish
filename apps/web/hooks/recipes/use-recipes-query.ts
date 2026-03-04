"use client";

import type { RecipeFilters, RecipesQueryResult } from "@norish/shared-react/hooks";

import { sharedDashboardRecipeHooks } from "./shared-recipe-hooks";

export type { RecipeFilters, RecipesQueryResult };

export const useRecipesQuery = sharedDashboardRecipeHooks.useRecipesQuery;
