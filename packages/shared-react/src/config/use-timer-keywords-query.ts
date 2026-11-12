import type { inferRouterOutputs } from "@trpc/server";
import { useQuery } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

import { useTRPC } from "../trpc";

type TimerKeywords = inferRouterOutputs<AppRouter>["config"]["timerKeywords"];

/** The keywords a step's timers are found by until the server's arrive. */
export const DEFAULT_TIMER_KEYWORDS: TimerKeywords = {
  enabled: true,
  hours: [],
  minutes: [],
  seconds: [],
  isOverridden: false,
};

/** How long the timer keywords stay fresh and held, wherever they are read. */
export const TIMER_KEYWORDS_READ_TIMES = { staleTime: 5 * 60 * 1000, gcTime: 60 * 60 * 1000 };

export function useTimerKeywordsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timerKeywords.queryOptions(),
    ...TIMER_KEYWORDS_READ_TIMES,
  });

  return {
    timerKeywords: data ?? DEFAULT_TIMER_KEYWORDS,
    isLoading,
    error,
  };
}
