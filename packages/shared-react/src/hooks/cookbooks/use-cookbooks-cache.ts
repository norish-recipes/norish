import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type {
  CookbooksCacheHelpers,
  CreateCookbookHooksOptions,
  InfiniteCookbookData,
} from "./types";

export function createUseCookbooksCache({ useTRPC }: CreateCookbookHooksOptions) {
  return function useCookbooksCacheHelpers(): CookbooksCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const listPath = useMemo(() => [trpc.cookbooks.list.queryKey({})[0]], [trpc]);
    const membershipPaths = useMemo(
      () => [
        [trpc.cookbooks.forRecipe.queryKey({ recipeId: "" })[0]],
        [trpc.cookbooks.editableForRecipe.queryKey({ recipeId: "" })[0]],
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
      },
      [queryClient, listPath]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey: listPath });
    }, [queryClient, listPath]);

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
          queryClient.invalidateQueries({
            queryKey: trpc.cookbooks.editableForRecipe.queryKey({ recipeId }),
          });

          return;
        }

        for (const path of membershipPaths) {
          queryClient.invalidateQueries({ queryKey: path });
        }
      },
      [queryClient, trpc, membershipPaths]
    );

    return { setAllCookbooksData, invalidate, invalidateCookbook, invalidateMembership };
  };
}
