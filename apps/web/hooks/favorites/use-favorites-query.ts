"use client";

import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";

export function useFavoritesQuery() {
  return sharedDashboardRecipeHooks.useFavoritesQuery();
}
