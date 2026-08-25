import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import type { InfiniteLibraryData } from "../library/library-cache";
import type {
  CookbooksCacheHelpers,
  CreateCookbookHooksOptions,
  InfiniteCookbookData,
} from "./types";
import { applyCookbookUpdateToLibrary } from "../library/library-cache";

export function createUseCookbooksCache({ useTRPC }: CreateCookbookHooksOptions) {
  return function useCookbooksCacheHelpers(): CookbooksCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const listPath = useMemo(() => [trpc.cookbooks.list.queryKey({})[0]], [trpc]);
    // Cookbooks are Library rows too, so a change here has to reach the
    // interleaved list as well (ADR-0026).
    const libraryPath = useMemo(() => [trpc.library.list.queryKey({})[0]], [trpc]);
    const membershipPaths = useMemo(
      () => [
        [trpc.cookbooks.forRecipe.queryKey({ recipeId: "" })[0]],
        [trpc.cookbooks.recipes.queryKey({ cookbookId: "" })[0]],
      ],
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
      },
      [queryClient, listPath, libraryPath]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey: listPath });
      queryClient.invalidateQueries({ queryKey: libraryPath });
    }, [queryClient, listPath, libraryPath]);

    const invalidateCookbook = useCallback(
      (cookbookId: string) => {
        queryClient.invalidateQueries({
          queryKey: trpc.cookbooks.get.queryKey({ id: cookbookId }),
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

    return {
      setAllCookbooksData,
      invalidate,
      invalidateCookbook,
      invalidateMembership,
      patchRecipeMembership,
    };
  };
}
