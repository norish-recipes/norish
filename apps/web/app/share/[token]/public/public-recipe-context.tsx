"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { useSharePublicConfigQuery } from "@/hooks/recipes/use-share-public-config-query";
import { useIngredientLinkHighlight } from "@/hooks/use-ingredient-link-highlight";

import type { PublicRecipeContextValue, SharedRecipe } from "./types";
import { useShareRecipeState } from "./use-share-recipe-state";

const PublicRecipeContext = createContext<PublicRecipeContextValue | null>(null);

export function PublicRecipeProvider({
  children,
  recipe,
  token,
}: {
  children: ReactNode;
  recipe: SharedRecipe;
  token: string;
}) {
  const { units } = useSharePublicConfigQuery(token);
  const state = useShareRecipeState(recipe);
  const { highlightedIngredientKey, highlightIngredient, ingredientListRef } =
    useIngredientLinkHighlight();

  const value = useMemo(
    () => ({
      token,
      recipe,
      units,
      state,
      highlightedIngredientKey,
      ingredientListRef,
      highlightIngredient,
    }),
    [token, recipe, units, state, highlightedIngredientKey, ingredientListRef, highlightIngredient]
  );

  return <PublicRecipeContext.Provider value={value}>{children}</PublicRecipeContext.Provider>;
}

export function usePublicRecipeContext() {
  const context = useContext(PublicRecipeContext);

  if (!context) {
    throw new Error("usePublicRecipeContext must be used within PublicRecipeProvider");
  }

  return context;
}
