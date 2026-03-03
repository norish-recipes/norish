import { useQuery } from '@tanstack/react-query';
import type { UnitsMap } from '@norish/config/zod/server-config';

import { getQueryOptions, type CreateConfigHooksOptions, type TrpcHookBinding } from './types';

export function createUseUnitsQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useUnitsQuery() {
    const trpc = useTRPC() as TrpcHookBinding;

    const { data, error, isLoading } = useQuery({
      ...getQueryOptions(trpc.config.units.queryOptions),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      units: (data ?? {}) as UnitsMap,
      isLoading,
      error,
    };
  };
}
