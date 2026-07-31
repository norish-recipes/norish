"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to fetch the deployment's Cuisine vocabulary.
 * Used by the recipe form's Cuisine picker and by administration.
 */
export function useCuisinesQuery() {
  return sharedConfigHooks.useCuisinesQuery();
}
