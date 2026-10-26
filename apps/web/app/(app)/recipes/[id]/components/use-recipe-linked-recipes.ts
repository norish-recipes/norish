"use client";

import { useCallback } from "react";
import { useRecipeContextRequired } from "@/app/(app)/recipes/[id]/context";
import { useLinkedRecipes } from "@/hooks/recipes";

import type { LinkedRecipesTree } from "@norish/shared-react/hooks";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { linkedRecipeScaleFactor, scaleIngredientAmounts } from "@norish/shared/lib/linked-recipes";

export type RecipeLinkedRecipes = {
  tree: LinkedRecipesTree | null;
  /** A linked recipe's lines, scaled with the servings the reader chose for this recipe. */
  ingredientsFor: (linked: FullRecipeDTO) => FullRecipeDTO["recipeIngredients"];
};

/**
 * The recipes this recipe's steps link to, expanded for the recipe page and
 * cooking mode: each linked recipe's steps after the step that links it, and
 * its lines scaled along with the recipe's own — doubling a pizza doubles its
 * dough.
 */
export function useRecipeLinkedRecipes(): RecipeLinkedRecipes {
  const { recipe, currentServings } = useRecipeContextRequired();
  const { tree } = useLinkedRecipes(recipe, recipe.systemUsed);
  const scale = linkedRecipeScaleFactor(recipe.servings, currentServings);

  const ingredientsFor = useCallback(
    (linked: FullRecipeDTO) => scaleIngredientAmounts(linked.recipeIngredients, scale),
    [scale]
  );

  return { tree, ingredientsFor };
}
