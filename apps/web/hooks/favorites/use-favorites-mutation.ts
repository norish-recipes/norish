"use client";

import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";

export function useFavoritesMutation() {
  return sharedDashboardRecipeHooks.useFavoritesMutation();
}
