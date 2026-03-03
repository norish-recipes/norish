import { useQuery } from '@tanstack/react-query';
import type { RecurrenceConfig } from '@norish/shared/contracts/recurrence';

import { getQueryOptions, type CreateConfigHooksOptions, type TrpcHookBinding } from './types';

export function createUseRecurrenceConfigQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useRecurrenceConfigQuery() {
    const trpc = useTRPC() as TrpcHookBinding;

    const { data, error, isLoading } = useQuery({
      ...getQueryOptions(trpc.config.recurrenceConfig.queryOptions),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      recurrenceConfig: data as RecurrenceConfig | undefined,
      isLoading,
      error,
    };
  };
}
