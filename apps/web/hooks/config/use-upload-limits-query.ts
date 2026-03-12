"use client";

import type { UploadLimits } from "@norish/shared-react/hooks";

import { sharedConfigHooks } from "./shared-config-hooks";

export type { UploadLimits };

/**
 * Hook to fetch upload size limits from server configuration.
 * Limits are configurable via environment variables on the server.
 *
 * @returns Upload limits with loading state
 */
export function useUploadLimitsQuery() {
  return sharedConfigHooks.useUploadLimitsQuery();
}
