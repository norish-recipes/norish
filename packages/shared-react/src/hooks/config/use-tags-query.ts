import { useQuery } from '@tanstack/react-query';

import { getQueryOptions, type CreateConfigHooksOptions, type TrpcHookBinding } from './types';

export function createUseTagsQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useTagsQuery() {
    const trpc = useTRPC() as TrpcHookBinding;

    const { data, error, isLoading } = useQuery({
      ...getQueryOptions(trpc.config.tags.queryOptions),
      staleTime: 5 * 60 * 1000,
    });

    return {
      tags: (data as { tags?: string[] } | undefined)?.tags ?? [],
      error,
      isLoading,
    };
  };
}
