import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { LinkedRecipeTree } from "@norish/shared/lib/linked-recipes";
import { expandLinkedRecipes } from "@norish/shared/lib/linked-recipes";

import type { CreateRecipeHooksOptions } from "../types";

type FullRecipeStep = NonNullable<FullRecipeDTO["steps"]>[number];

export type LinkedRecipesTree = LinkedRecipeTree<FullRecipeDTO, FullRecipeStep>;

export type LinkedRecipesResult = {
  /** The recipe's steps with its linked recipes expanded; null until the recipe is there. */
  tree: LinkedRecipesTree | null;
  /** True while a linked recipe the tree reaches for is still on its way. */
  isLoading: boolean;
};

const EMPTY_IDS: string[] = [];

function combineLinkedRecipes(results: { data?: FullRecipeDTO; isLoading: boolean }[]) {
  return {
    recipes: results.map((result) => result.data),
    isLoading: results.some((result) => result.isLoading),
  };
}

/**
 * Every recipe the expansion reaches for, following links through whatever
 * linked recipes `lookup` already holds: the fixed point of "expand, then
 * load what the expansion asked for".
 */
export function requestedLinkedRecipeIds(
  recipe: FullRecipeDTO,
  systemUsed: string,
  lookup: (id: string) => FullRecipeDTO | undefined
): string[] {
  const known = new Map<string, FullRecipeDTO>();

  for (;;) {
    const { requestedIds } = expandLinkedRecipes<FullRecipeDTO, FullRecipeStep>(recipe, known, {
      systemUsed,
    });
    let grew = false;

    for (const id of requestedIds) {
      if (known.has(id)) continue;

      const data = lookup(id);

      if (data) {
        known.set(id, data);
        grew = true;
      }
    }

    if (!grew) return requestedIds;
  }
}

/**
 * The recipes a recipe's steps link to, fetched as the recipe's own query is
 * (so they are shared with, and kept offline like, a visit to their page),
 * and expanded into the recipe's steps.
 *
 * Which recipes are needed depends on the ones already loaded — a linked
 * dough may link its own starter — so the set is worked out from the cache on
 * every render: each linked recipe that arrives re-renders this hook, which
 * then asks for whatever that recipe links in turn. The loop ends because a
 * recipe is reached for at most once and the depth is capped.
 */
export function createUseLinkedRecipes({ useTRPC }: CreateRecipeHooksOptions) {
  return function useLinkedRecipes(
    recipe: FullRecipeDTO | null | undefined,
    systemUsed?: string | null
  ): LinkedRecipesResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const system = systemUsed ?? recipe?.systemUsed ?? "metric";

    // Read on every render rather than memoised on the cache: the queries
    // below re-render this hook whenever one of them settles, and that render
    // is when a newly arrived recipe's own links are first seen.
    const reachedIds = recipe
      ? requestedLinkedRecipeIds(recipe, system, (id) =>
          queryClient.getQueryData<FullRecipeDTO>(trpc.recipes.get.queryKey({ id }))
        )
      : EMPTY_IDS;
    const reachedKey = reachedIds.join(",");
    // Kept by content, so an unchanged set leaves the tree below memoised.
    const requestedIds = useMemo(() => reachedIds, [reachedKey]);

    const { recipes, isLoading } = useQueries({
      queries: requestedIds.map((id) => trpc.recipes.get.queryOptions({ id })),
      combine: combineLinkedRecipes,
    });

    const tree = useMemo(() => {
      if (!recipe) return null;

      const loaded = new Map<string, FullRecipeDTO>();

      recipes.forEach((data, index) => {
        const id = requestedIds[index];

        if (data && id) loaded.set(id, data);
      });

      return expandLinkedRecipes<FullRecipeDTO, FullRecipeStep>(recipe, loaded, {
        systemUsed: system,
      });
    }, [recipe, recipes, requestedIds, system]);

    return { tree, isLoading };
  };
}
