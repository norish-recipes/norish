"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to fetch all unique tags
 * Used by tag input and filter components
 */
export function useTagsQuery() {
  return sharedConfigHooks.useTagsQuery();
}
