"use client";

import type { TagsQueryOptions } from "@norish/shared-react/hooks";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to fetch all unique tags
 * Used by tag input and filter components
 */
export function useTagsQuery(options?: TagsQueryOptions) {
  return sharedConfigHooks.useTagsQuery(options);
}
