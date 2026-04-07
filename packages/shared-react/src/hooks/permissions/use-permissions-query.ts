import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreatePermissionsHooksOptions, PermissionsData } from "./types";

type SubscriptionOptions = Parameters<typeof useSubscription>[0];

export function createUsePermissionsQuery({ useTRPC }: CreatePermissionsHooksOptions) {
  return function usePermissionsQuery() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const queryKey = trpc.permissions.get.queryKey();
    const { data, error, isLoading } = useQuery(trpc.permissions.get.queryOptions());

    const invalidate = useCallback(() => {
      void queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    useSubscription(
      trpc.permissions.onPolicyUpdated.subscriptionOptions(undefined, {
        onData: () => {
          void queryClient.invalidateQueries();
        },
      }) as SubscriptionOptions
    );

    return {
      data: data as PermissionsData | undefined,
      isLoading,
      error,
      invalidate,
    };
  };
}
