import { useQuery } from "@tanstack/react-query";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import type { CreateCookbookHooksOptions } from "./types";

export type CookbookQueryResult = {
  cookbook: CookbookSummaryDTO | undefined;
  isLoading: boolean;
  /** True only once the read has come back and said there is nothing there. */
  isNotFound: boolean;
  error: unknown;
};

export function createUseCookbookQuery({ useTRPC }: CreateCookbookHooksOptions) {
  return function useCookbookQuery(cookbookId: string): CookbookQueryResult {
    const trpc = useTRPC();
    const { data, error, isLoading } = useQuery({
      ...trpc.cookbooks.get.queryOptions({ id: cookbookId }),
      retry: false,
    });

    return {
      cookbook: data ?? undefined,
      isLoading,
      isNotFound: !isLoading && !data && error !== null,
      error,
    };
  };
}
