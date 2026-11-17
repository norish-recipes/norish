"use client";

import { useQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { useTRPC } from "../trpc";

export type CookbookQueryResult = {
  cookbook: CookbookSummaryDTO | undefined;
  isLoading: boolean;
  /** True only once the server has answered NOT_FOUND; any other failure keeps the page loading. */
  isNotFound: boolean;
  error: unknown;
};

const isNotFoundError = (error: unknown) =>
  error instanceof TRPCClientError && error.data?.code === "NOT_FOUND";

export function useCookbookQuery(
  cookbookId: string,
  { enabled = true }: { enabled?: boolean } = {}
): CookbookQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery({
    ...trpc.cookbooks.get.queryOptions({ id: cookbookId }),
    enabled: enabled && Boolean(cookbookId),
    retry: (failures, error) => !isNotFoundError(error) && failures < 1,
  });

  return {
    cookbook: data ?? undefined,
    isLoading,
    isNotFound: !data && isNotFoundError(error),
    error,
  };
}
