"use client";

import type { EnabledLocale, LocaleConfigResult } from "@norish/shared-react/hooks";

import { sharedConfigHooks } from "./shared-config-hooks";

export type { EnabledLocale, LocaleConfigResult };

/**
 * Hook to fetch public locale configuration.
 * Works for both authenticated and unauthenticated users.
 *
 * Used by language switchers to know which locales are enabled.
 */
export function useLocaleConfigQuery() {
  return sharedConfigHooks.useLocaleConfigQuery();
}
