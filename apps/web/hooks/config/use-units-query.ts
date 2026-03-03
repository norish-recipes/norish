"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to fetch units configuration for ingredient parsing.
 * Used by client components that need to parse ingredients.
 */
export function useUnitsQuery() {
  return sharedConfigHooks.useUnitsQuery();
}
