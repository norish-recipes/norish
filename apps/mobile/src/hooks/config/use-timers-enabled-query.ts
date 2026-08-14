import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to check if recipe timers are enabled globally.
 *
 * The reader's own timers hide is a web device preference (the
 * `norish_hidden_items` cookie, ticket 23) and cannot reach the native app,
 * which also has no control to set it — so mobile answers with the
 * deployment-wide capability alone.
 */
export function useTimersEnabledQuery() {
  const { globalEnabled, error, isLoading } = sharedConfigHooks.useTimersEnabledBaseQuery();

  return {
    timersEnabled: globalEnabled,
    globalEnabled,
    isLoading,
    error,
  };
}
