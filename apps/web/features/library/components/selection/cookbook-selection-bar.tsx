"use client";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookList } from "@norish/shared-react/recipes";

import RecipeSelectionBar from "./recipe-selection-bar";

/** The selection bar over a cookbook's members, whose versions it acts on. */
export function CookbookSelectionBar({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const { recipes, removeMember } = useCookbookList(cookbook.id);

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
