"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

export type CookbookMemberIdsQueryResult = {
  memberIds: string[];
  isLoading: boolean;
};

/**
 * Which recipes a cookbook already holds.
 *
 * Ids alone, for the whole cookbook rather than a page of it: the one caller
 * is the panel that fills a cookbook in bulk, and it needs to leave out what
 * is already in there however large the cookbook is.
 */
export function useCookbookMemberIdsQuery(cookbookId: string): CookbookMemberIdsQueryResult {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.cookbooks.memberIds.queryOptions({ cookbookId }),
    enabled: Boolean(cookbookId),
  });

  return { memberIds: data ?? [], isLoading };
}
