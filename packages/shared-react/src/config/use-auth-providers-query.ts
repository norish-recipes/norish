import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** The Sign-in Methods the server offers, and whether it takes new accounts. */
export function useAuthProvidersQuery() {
  const trpc = useTRPC();
  const { data, isLoading, error, refetch, fetchStatus } = useQuery(
    trpc.config.authProviders.queryOptions(undefined, { staleTime: 30_000 })
  );

  return {
    providers: data?.providers ?? [],
    registrationEnabled: data?.registrationEnabled ?? false,
    passwordAuthEnabled: data?.passwordAuthEnabled ?? false,
    isLoading,
    // Offline, the first fetch waits: no loading, no error, and no data.
    isPaused: fetchStatus === "paused",
    error,
    refetch,
    hasData: !!data,
  };
}
