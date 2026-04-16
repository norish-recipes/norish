import { useUserContext } from "@/context/user-context";

import { getTimersEnabledPreference } from "@norish/shared/lib/user-preferences";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to check if recipe timers are enabled globally AND for the current user.
 * Logic: globalEnabled AND (userPreference ?? true)
 *
 * Mirrors the web's useTimersEnabledQuery.
 */
export function useTimersEnabledQuery() {
  const user = useUserContext().user;

  const { globalEnabled, error, isLoading } = sharedConfigHooks.useTimersEnabledBaseQuery();
  const userPrefEnabled = getTimersEnabledPreference(user);

  const isTimersEnabled = globalEnabled && userPrefEnabled;

  return {
    timersEnabled: isTimersEnabled,
    globalEnabled,
    isLoading,
    error,
  };
}
