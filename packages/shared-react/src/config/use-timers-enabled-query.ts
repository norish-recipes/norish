import { useQuery } from "@tanstack/react-query";

import { useDevicePreference } from "../reader";
import { useTRPC } from "../trpc";

/**
 * Whether recipe timers are on: the deployment allows them and the reader has
 * not hidden them. The reader's layer reads the seeded Hidden Items, so it is
 * right from the first frame.
 */
export function useTimersEnabledQuery() {
  const trpc = useTRPC();
  const [hidden] = useDevicePreference("hiddenItems");

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timersEnabled.queryOptions(),
    staleTime: 5 * 60 * 1000,
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
