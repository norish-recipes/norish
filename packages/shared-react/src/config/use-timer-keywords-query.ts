import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

const DEFAULT_TIMER_KEYWORDS = {
  enabled: true,
  hours: [],
  minutes: [],
  seconds: [],
  isOverridden: false,
};

export function useTimerKeywordsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timerKeywords.queryOptions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    timerKeywords: data ?? DEFAULT_TIMER_KEYWORDS,
    isLoading,
    error,
  };
}
