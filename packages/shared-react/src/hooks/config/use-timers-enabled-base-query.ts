import { useQuery } from '@tanstack/react-query';

import { getQueryOptions, type CreateConfigHooksOptions, type TrpcHookBinding } from './types';

export function createUseTimersEnabledBaseQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useTimersEnabledBaseQuery() {
    const trpc = useTRPC() as TrpcHookBinding;

    const { data, error, isLoading } = useQuery({
      ...getQueryOptions(trpc.config.timersEnabled.queryOptions),
      staleTime: 5 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      globalEnabled: (data as boolean | undefined) ?? true,
      isLoading,
      error,
    };
  };
}
