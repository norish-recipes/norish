"use client";

import { useRecipeLinkedRecipes } from "@/app/(app)/recipes/[id]/components/use-recipe-linked-recipes";
import { LinkedRecipeIngredientsSections } from "@/components/recipes/linked-recipe-sections";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";

import { useRecipeContextRequired } from "../context";

export default function IngredientsList() {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const { tree, ingredientsFor } = useRecipeLinkedRecipes();
  const display = adjustedIngredients?.length > 0 ? adjustedIngredients : recipe.recipeIngredients;
  const sections = (tree?.sections ?? []).map((section) => ({
    recipe: section.recipe,
    ingredients: ingredientsFor(section.recipe),
  }));

  return (
    <div className="flex flex-col gap-4">
      <ReadonlyIngredientsList interactive ingredients={display} systemUsed={recipe.systemUsed} />
      <LinkedRecipeIngredientsSections
        interactive
        sections={sections}
        systemUsed={recipe.systemUsed}
      />
    </div>
  );
}
