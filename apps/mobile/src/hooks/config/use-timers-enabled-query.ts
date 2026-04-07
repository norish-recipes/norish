import { useUserContext } from "@/context/user-context";
import { useTRPC } from "@/providers/trpc-provider";

import { createConfigHooks } from "@norish/shared-react/hooks";
import { getTimersEnabledPreference } from "@norish/shared/lib/user-preferences";

const sharedConfigHooks = createConfigHooks({ useTRPC });

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
