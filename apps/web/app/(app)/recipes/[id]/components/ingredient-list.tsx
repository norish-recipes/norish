"use client";

import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";

import { useRecipeContextRequired } from "../context";

export default function IngredientsList() {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const display = adjustedIngredients?.length > 0 ? adjustedIngredients : recipe.recipeIngredients;

  return (
    <ReadonlyIngredientsList interactive ingredients={display} systemUsed={recipe.systemUsed} />
  );
}
