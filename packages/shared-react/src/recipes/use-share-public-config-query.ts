"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useQuery } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

import { DEFAULT_TIMER_KEYWORDS, TIMER_KEYWORDS_READ_TIMES } from "../config";
import { useTRPC } from "../trpc";

type SharePublicConfig = inferRouterOutputs<AppRouter>["recipes"]["sharePublicConfig"];

/** One slice of a share's public config; the defaults answer until it arrives. */
export function useSharePublicConfigQuery<T>(
  token: string,
  select: (config: SharePublicConfig) => T
): T {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.recipes.sharePublicConfig.queryOptions({ token }),
    ...TIMER_KEYWORDS_READ_TIMES,
    select,
  });

  if (data !== undefined) return data;

  return select({ units: {}, timersEnabled: true, timerKeywords: DEFAULT_TIMER_KEYWORDS });
}
