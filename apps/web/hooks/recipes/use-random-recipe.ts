"use client";

import type { RandomRecipeResult } from "@norish/shared-react/hooks";

import { sharedDashboardRecipeHooks } from "./shared-recipe-hooks";

export type { RandomRecipeResult };

export const useRandomRecipe = sharedDashboardRecipeHooks.useRandomRecipe;
