import { useQuery } from "@tanstack/react-query";

import type {
  CreateCookbookHooksOptions,
  EditableCookbooksQueryResult,
  RecipeCookbooksQueryResult,
} from "./types";

/** The cookbooks a recipe is in, as the recipe page's card lists them. */
export function createUseRecipeCookbooksQuery({ useTRPC }: CreateCookbookHooksOptions) {
  return function useRecipeCookbooksQuery(
    recipeId: string | null,
    { enabled = true }: { enabled?: boolean } = {}
  ): RecipeCookbooksQueryResult {
    const trpc = useTRPC();
    const { data, isLoading } = useQuery({
      ...trpc.cookbooks.forRecipe.queryOptions({ recipeId: recipeId ?? "" }),
      enabled: enabled && Boolean(recipeId),
    });

    return { cookbooks: data ?? [], isLoading };
  };
}

/**
 * Every cookbook the reader may edit, each saying whether it already holds
 * this recipe — read in one go so the panel is one list rather than a list
 * plus a lookup per row.
 */
export function createUseEditableCookbooksQuery({ useTRPC }: CreateCookbookHooksOptions) {
  return function useEditableCookbooksQuery(
    recipeId: string | null,
    { enabled = true }: { enabled?: boolean } = {}
  ): EditableCookbooksQueryResult {
    const trpc = useTRPC();
    const { data, isLoading } = useQuery({
      ...trpc.cookbooks.editableForRecipe.queryOptions({ recipeId: recipeId ?? "" }),
      enabled: enabled && Boolean(recipeId),
    });

    return { cookbooks: data ?? [], isLoading };
  };
}
