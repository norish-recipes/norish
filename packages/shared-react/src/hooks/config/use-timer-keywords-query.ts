import { useQuery } from '@tanstack/react-query';

import { getQueryOptions, type CreateConfigHooksOptions, type TimerKeywordsConfig, type TrpcHookBinding } from './types';

const DEFAULT_TIMER_KEYWORDS: TimerKeywordsConfig = {
  enabled: true,
  hours: [],
  minutes: [],
  seconds: [],
  isOverridden: false,
};

export function createUseTimerKeywordsQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useTimerKeywordsQuery() {
    const trpc = useTRPC() as TrpcHookBinding;

    const { data, error, isLoading } = useQuery({
      ...getQueryOptions(trpc.config.timerKeywords.queryOptions),
      staleTime: 5 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      timerKeywords: (data as TimerKeywordsConfig | undefined) ?? DEFAULT_TIMER_KEYWORDS,
      isLoading,
      error,
    };
  };
}
