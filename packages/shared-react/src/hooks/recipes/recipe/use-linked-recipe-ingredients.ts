import type { CreateRecipeHooksOptions } from "../types";
import type { SystemScopedIngredientDto } from "./use-recipe-ingredients";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { selectIngredientsForSystem } from "./use-recipe-ingredients";

export function createUseLinkedRecipeIngredients({ useTRPC }: CreateRecipeHooksOptions) {
  return function useLinkedRecipeIngredients(
    recipeIds: string[],
    preferredSystem?: string | null
  ) {
    const trpc = useTRPC();
    const queries = useQueries({
      queries: recipeIds.map((id) => trpc.recipes.get.queryOptions({ id })),
    });

    const ingredients = useMemo(
      () =>
        queries.flatMap((query) => {
          const recipe = query.data;

          if (!recipe) return [];

          return selectIngredientsForSystem(
            recipe.recipeIngredients as SystemScopedIngredientDto[],
            preferredSystem,
            recipe.systemUsed
          );
        }),
      [queries, preferredSystem]
    );

    return {
      ingredients,
      isLoading: queries.some((query) => query.isLoading),
    };
  };
}
