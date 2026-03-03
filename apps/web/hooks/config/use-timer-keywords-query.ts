"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to get timer keywords configuration.
 */
export function useTimerKeywordsQuery() {
  return sharedConfigHooks.useTimerKeywordsQuery();
}
