"use client";

import type { Ref } from "react";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";

import { useRecipeContextRequired } from "../context";

type IngredientsListProps = {
  highlightedIngredientKey?: string | null;
  ingredientListRef?: Ref<HTMLUListElement>;
};

export default function IngredientsList({
  highlightedIngredientKey,
  ingredientListRef,
}: IngredientsListProps = {}) {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const display = adjustedIngredients?.length > 0 ? adjustedIngredients : recipe.recipeIngredients;

  return (
    <ReadonlyIngredientsList
      interactive
      highlightedIngredientKey={highlightedIngredientKey}
      ingredientListRef={ingredientListRef}
      ingredients={display}
      systemUsed={recipe.systemUsed}
    />
  );
}
