import type { inferRouterInputs } from "@trpc/server";
import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQueries,
  useQuery,
} from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

import { useTRPC } from "../trpc";

export type IngredientListInput = Omit<
  inferRouterInputs<AppRouter>["ingredients"]["list"],
  "cursor"
>;

/** The Ingredients page's list, a page at a time; the previous rows stay while other filters are read. */
export function useIngredientListQuery(input: IngredientListInput) {
  const trpc = useTRPC();
  const query = useInfiniteQuery(
    trpc.ingredients.list.infiniteQueryOptions(input, {
      getNextPageParam: (page) => page.nextCursor,
      placeholderData: keepPreviousData,
    })
  );

  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: query.isLoading,
    isPlaceholderData: query.isPlaceholderData,
    isPaused: query.fetchStatus === "paused",
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    // A next page asked while the list is read again must not cancel that read.
    fetchNextPage: () => void query.fetchNextPage({ cancelRefetch: false }),
  };
}

/** The first page of foods a search finds, for a picker; nothing is read for an empty search. */
export function useIngredientSearchQuery(search: string, locale: string) {
  const trpc = useTRPC();
  const { data, isFetching } = useQuery({
    ...trpc.ingredients.list.queryOptions({ search, locale }),
    enabled: search.length > 0,
  });

  return { items: data?.items ?? [], isFetching };
}

/** Every catalogue food a search finds, unlisted ones included, for the Pantry; `null` reads nothing. */
export function useCatalogueMatchesQuery(search: string | null, locale: string) {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.ingredients.list.queryOptions(
      search === null ? skipToken : { search, locale, listedOnly: false }
    )
  );

  return data?.items;
}

/** The kinds filed under each parent, read as each is asked for, in the order asked. */
export function useIngredientKinds(parentIds: readonly string[], locale: string) {
  const trpc = useTRPC();

  return useQueries({
    queries: parentIds.map((parentId) => trpc.ingredients.kinds.queryOptions({ parentId, locale })),
    combine: (results) =>
      results.map((result) => ({
        items: result.data,
        loading: result.isPending,
      })),
  });
}

/** One food read on its own, for a panel whose list no longer lists it. */
export function useIngredientQuery(ingredientId: string, locale: string) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.ingredients.get.queryOptions({ ingredientId, locale }));

  return data ?? null;
}

/** That read as the cache holds it, never fetched here: what a mounted `useIngredientQuery` read. */
export function useHeldIngredient(ingredientId: string, locale: string) {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.ingredients.get.queryOptions({ ingredientId, locale }),
    enabled: false,
  });

  return data ?? null;
}

/** Every spelling a food goes by, in every language. */
export function useIngredientSpellingsQuery(ingredientId: string) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.ingredients.spellings.queryOptions({ ingredientId }));

  return data;
}

/** What still uses a food, as far as the reader may see. */
export function useIngredientUsesQuery(ingredientId: string) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(trpc.ingredients.uses.queryOptions({ ingredientId }));

  return { uses: data, isPending };
}
