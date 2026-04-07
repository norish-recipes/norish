import { useTRPC } from "@/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

import type { AuthProvidersResponse } from "@norish/shared/contracts";

export function useAuthProvidersQuery() {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.config.authProviders.queryOptions(undefined, {
      staleTime: 30_000,
    })
  );
  const data = query.data as AuthProvidersResponse | undefined;

  return {
    providers: data?.providers ?? [],
    registrationEnabled: data?.registrationEnabled ?? false,
    passwordAuthEnabled: data?.passwordAuthEnabled ?? false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    hasData: !!data,
  };
}
