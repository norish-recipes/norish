"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CookbookSummaryDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import {
  DEFAULT_RECIPE_FILTERS,
  toRecipesQueryFilters,
} from "@norish/shared/contracts/filter-contract";
import { cookbookRecipesInput } from "@norish/shared/contracts/list-queries";

import type { CookbooksCacheHelpers, InfiniteCookbookData } from "./cookbook-types";
import type { InfiniteLibraryData, InfiniteRecipeData } from "./library-cache";
import { useTRPC } from "../trpc";
import { applyCookbookUpdateToLibrary, applyCookbookUpdateToList } from "./library-cache";
import { cookbookIdOf } from "./use-cookbook-recipes-query";

export function useCookbooksCacheHelpers(): CookbooksCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listPath = trpc.cookbooks.list.pathKey();
  // The membership panel's list is a cookbook list too, and it is the one a
  // reader is looking at while they create one. Leaving it out of these
  // helpers is what made a cookbook created from a recipe exist on the
  // server and stay invisible in the panel that created it.
  const editableKey = useMemo(() => trpc.cookbooks.editable.queryKey(), [trpc]);
  // Cookbooks are Library rows too, so a change here has to reach the
  // interleaved list as well (ADR-0026).
  const libraryPath = trpc.library.list.pathKey();
  const membershipPaths = useMemo(
    () => [trpc.cookbooks.forRecipe.pathKey(), trpc.cookbooks.recipes.pathKey()],
    [trpc]
  );

  const setAllCookbooksData = useCallback<CookbooksCacheHelpers["setAllCookbooksData"]>(
    (updater) => {
      for (const [key] of queryClient.getQueriesData<InfiniteCookbookData>({
        queryKey: listPath,
      })) {
        queryClient.setQueryData<InfiniteCookbookData>(key, updater);
      }

      for (const [key] of queryClient.getQueriesData<InfiniteLibraryData>({
        queryKey: libraryPath,
      })) {
        queryClient.setQueryData<InfiniteLibraryData>(key, (previous) =>
          applyCookbookUpdateToLibrary(previous, updater)
        );
      }

      queryClient.setQueryData<CookbookSummaryDTO[]>(editableKey, (previous) =>
        applyCookbookUpdateToList(previous, updater)
      );
    },
    [queryClient, listPath, libraryPath, editableKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: listPath });
    queryClient.invalidateQueries({ queryKey: libraryPath });
    queryClient.invalidateQueries({ queryKey: editableKey });
  }, [queryClient, listPath, libraryPath, editableKey]);

  /**
   * Everything one cookbook answers for: the row itself, its member list and
   * which recipes it holds.
   *
   * The member list is keyed by whatever sort, search and filters the reader
   * had on, so it is matched by path and read back out of the key rather
   * than guessed — adding a recipe from the cookbook's own page used to
   * leave that page listing what it held a moment earlier.
   */
  const invalidateCookbook = useCallback(
    (cookbookId: string) => {
      queryClient.invalidateQueries({
        queryKey: trpc.cookbooks.get.queryKey({ id: cookbookId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.cookbooks.recipes.pathKey(),
        predicate: (query) => cookbookIdOf(query.queryKey) === cookbookId,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.cookbooks.memberIds.queryKey({ cookbookId }),
      });
    },
    [queryClient, trpc]
  );

  const invalidateMembership = useCallback(
    (recipeId?: string) => {
      if (recipeId) {
        queryClient.invalidateQueries({
          queryKey: trpc.cookbooks.forRecipe.queryKey({ recipeId }),
        });

        return;
      }

      for (const path of membershipPaths) {
        queryClient.invalidateQueries({ queryKey: path });
      }
    },
    [queryClient, trpc, membershipPaths]
  );

  /**
   * Apply a membership change to the recipe's own list of cookbooks.
   *
   * Written straight into the cache rather than refetched, because Offline
   * there is nothing to refetch: a queued filing has to read as tentatively
   * applied on both the panel's toggle and the recipe page's card, and both
   * derive from this one answer (ADR-0009).
   */
  const patchRecipeMembership = useCallback(
    (recipeId: string, cookbook: CookbookSummaryDTO, isMember: boolean) => {
      queryClient.setQueryData<CookbookSummaryDTO[]>(
        trpc.cookbooks.forRecipe.queryKey({ recipeId }),
        (previous) => {
          const current = previous ?? [];

          if (!isMember) {
            return current.filter((entry) => entry.id !== cookbook.id);
          }

          if (current.some((entry) => entry.id === cookbook.id)) return current;

          return [...current, cookbook].sort((a, b) => a.title.localeCompare(b.title));
        }
      );
    },
    [queryClient, trpc]
  );

  const seedCookbook = useCallback(
    (cookbook: CookbookSummaryDTO) => {
      queryClient.setQueryData<CookbookSummaryDTO>(
        trpc.cookbooks.get.queryKey({ id: cookbook.id }),
        cookbook
      );
    },
    [queryClient, trpc]
  );

  /**
   * Write the recipes just picked into a new cookbook's own member list, so its page lists what
   * its card counts until Replay. They are read back from the recipe lists already cached.
   */
  // ponytail: the default-filter list only; a reader filtering the Library opens another key.
  const seedCookbookMembers = useCallback(
    (cookbookId: string, recipeIds: string[]) => {
      const known = new Map<string, RecipeDashboardDTO>();

      for (const [, data] of queryClient.getQueriesData<InfiniteRecipeData>({
        queryKey: trpc.recipes.list.pathKey(),
      })) {
        for (const page of data?.pages ?? []) {
          for (const recipe of page.recipes) known.set(recipe.id, recipe);
        }
      }

      const recipes = recipeIds.flatMap((id) => known.get(id) ?? []);

      queryClient.setQueryData<InfiniteRecipeData>(
        trpc.cookbooks.recipes.infiniteQueryKey(
          cookbookRecipesInput(cookbookId, toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS))
        ),
        { pages: [{ recipes, total: recipes.length, nextCursor: null }], pageParams: [0] }
      );
    },
    [queryClient, trpc]
  );

  return {
    setAllCookbooksData,
    invalidate,
    invalidateCookbook,
    invalidateMembership,
    patchRecipeMembership,
    seedCookbook,
    seedCookbookMembers,
  };
}
