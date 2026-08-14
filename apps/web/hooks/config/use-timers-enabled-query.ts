"use client";

import { useHiddenItems } from "@/context/hidden-items-context";

import type { HiddenItem } from "@norish/shared/contracts/zod/user";

import { sharedConfigHooks } from "./shared-config-hooks";

const TIMERS: HiddenItem = "timers";

/**
 * Hook to check if recipe timers are enabled globally AND for the current user.
 * Logic: globalEnabled AND (userPreference ?? true). The user's layer reads
 * the seeded hidden list, so it is right from the first frame.
 */
export function useTimersEnabledQuery() {
  const hidden = useHiddenItems();

  const { globalEnabled, error, isLoading } = sharedConfigHooks.useTimersEnabledBaseQuery();
  const userPrefEnabled = !hidden.includes(TIMERS);

  const isTimersEnabled = globalEnabled && userPrefEnabled;

  return {
    timersEnabled: isTimersEnabled,
    globalEnabled,
    isLoading,
    error,
  };
}
