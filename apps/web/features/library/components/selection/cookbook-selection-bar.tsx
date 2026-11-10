"use client";

import { useLibraryQueryFilters } from "@/features/library/hooks";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookRecipesQuery } from "@norish/shared-react/recipes";

import RecipeSelectionBar from "./recipe-selection-bar";

/** The selection bar over a cookbook's members, whose versions it acts on. */
export function CookbookSelectionBar({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const { queryFilters, isHydrated } = useLibraryQueryFilters();
  const { recipes, removeMember } = useCookbookRecipesQuery(cookbook.id, queryFilters, {
    enabled: isHydrated,
  });

  return (
    <RecipeSelectionBar
      cookbook={cookbook}
      recipes={recipes}
      onLeave={(recipeIds) => {
        for (const recipeId of recipeIds) removeMember(recipeId);
      }}
    />
  );
}
