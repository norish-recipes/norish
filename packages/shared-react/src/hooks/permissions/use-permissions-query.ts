import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PermissionsRealtime } from "@norish/shared/contracts/realtime/permissions";

import type { CreatePermissionsHooksOptions, PermissionsData } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

export function createUsePermissionsQuery({ useTRPC }: CreatePermissionsHooksOptions) {
  return function usePermissionsQuery() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const queryKey = trpc.permissions.get.queryKey();
    const { data, error, isLoading } = useQuery(trpc.permissions.get.queryOptions());

    // What a policy change can alter: the policy itself, and which recipes the
    // reader may see. Nothing else in the app depends on it.
    const affectedKeys = [queryKey, trpc.recipes.list.queryKey(), trpc.library.list.queryKey()];

    const invalidate = useCallback(() => {
      void queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    useRealtimeSubscription<PayloadOf<PermissionsRealtime, "policyUpdated">>(
      trpc.permissions.onPolicyUpdated,
      {
        onEvent: () => {
          for (const key of affectedKeys) void queryClient.invalidateQueries({ queryKey: key });
        },
        lagQueryKeys: affectedKeys,
      }
    );

    return {
      data: data as PermissionsData | undefined,
      isLoading,
      error,
      invalidate,
    };
  };
}
