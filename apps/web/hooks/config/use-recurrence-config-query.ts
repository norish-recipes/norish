"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to fetch recurrence configuration for natural language parsing.
 * Used by grocery panels for detecting recurrence patterns.
 */
export function useRecurrenceConfigQuery() {
  return sharedConfigHooks.useRecurrenceConfigQuery();
}
