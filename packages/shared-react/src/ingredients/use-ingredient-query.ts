import type { inferRouterInputs } from "@trpc/server";
import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQueries,
  useQuery,
} from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";
import { byNextCursor } from "@norish/shared/contracts/list-queries";

import { useTRPC } from "../trpc";
import { isNotFoundError } from "../trpc/not-found";

type IngredientListInput = Omit<inferRouterInputs<AppRouter>["ingredients"]["list"], "cursor">;

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
    /** The first read failed: no rows to show for it. */
    failed: query.isError && query.data === undefined,
    retry: () => void query.refetch(),
    isPlaceholderData: query.isPlaceholderData,
    isPaused: query.fetchStatus === "paused",
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    // A next page asked while the list is read again must not cancel that read.
    fetchNextPage: () => void query.fetchNextPage({ cancelRefetch: false }),
  };
}

/** The first page of foods a search finds; `null` reads nothing. `listedOnly: false` adds unlisted foods. */
export function useIngredientSearchQuery(
  search: string | null,
  locale: string,
  options: Pick<IngredientListInput, "listedOnly"> = {}
) {
  const trpc = useTRPC();
  const { data, isFetching, isLoading } = useQuery(
    trpc.ingredients.list.queryOptions(search === null ? skipToken : { search, locale, ...options })
  );

  return { items: data?.items ?? [], isFetching, isLoading };
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
  const { data, error, isError, refetch } = useQuery({
    ...trpc.ingredients.get.queryOptions({ ingredientId, locale }),
    // A failed read is shown with Retry at once, not after a silent second try.
    retry: false,
  });
  const gone = data === undefined && isNotFoundError(error);

  return {
    item: data ?? null,
    /** The read failed and nothing is held to show. */
    failed: isError && data === undefined && !gone,
    /** The server answered that the food no longer exists. */
    gone,
    retry: () => void refetch(),
  };
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

/** Which of the household's groceries and Pantry still use a food. */
export function useIngredientUsesQuery(ingredientId: string) {
  const trpc = useTRPC();
  const { data, isPending, isError, refetch } = useQuery(
    trpc.ingredients.uses.queryOptions({ ingredientId })
  );

  return {
    uses: data,
    isPending,
    failed: isError && data === undefined,
    retry: () => void refetch(),
  };
}

/** How many of the household's recipes, lines, groceries and Pantry rows use a food. */
export function useIngredientUseCounts(ingredientId: string) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(trpc.ingredients.countUses.queryOptions({ ingredientId }));

  return { counts: data, isPending };
}

/** The household's recipes that use a food, by name, a page at a time, as `useEntryRecipes`. */
export function useFoodRecipes(ingredientId: string) {
  const trpc = useTRPC();
  const { data, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(trpc.ingredients.recipes.infiniteQueryOptions({ ingredientId }, byNextCursor));

  return {
    recipes: data?.pages.flatMap((page) => page.recipes) ?? [],
    loaded: data !== undefined,
    failed: isError && data === undefined,
    retry: () => void refetch(),
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  };
}
