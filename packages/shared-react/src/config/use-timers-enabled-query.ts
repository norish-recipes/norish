import { useQuery } from "@tanstack/react-query";

import { useDevicePreference } from "../reader";
import { useTRPC } from "../trpc";

/** Recipe timers are on when the deployment allows them and the reader has not hidden them. */
export function useTimersEnabledQuery() {
  const trpc = useTRPC();
  const [hidden] = useDevicePreference("hiddenItems");

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timersEnabled.queryOptions(),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const globalEnabled = data ?? true;

  return {
    timersEnabled: globalEnabled && !hidden.includes("timers"),
    globalEnabled,
    isLoading,
    error,
  };
}
