import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** The Sign-in Methods the server offers, and whether it takes new accounts. */
export function useAuthProvidersQuery() {
  const trpc = useTRPC();
  const { data, isLoading, error, refetch } = useQuery(
    trpc.config.authProviders.queryOptions(undefined, { staleTime: 30_000 })
  );

  return {
    providers: data?.providers ?? [],
    registrationEnabled: data?.registrationEnabled ?? false,
    passwordAuthEnabled: data?.passwordAuthEnabled ?? false,
    isLoading,
    error,
    refetch,
    hasData: !!data,
  };
}
