"use client";

import { useRecipeLinkedRecipes } from "@/app/(app)/recipes/[id]/components/use-recipe-linked-recipes";
import {
  LinkedRecipeStepsSection,
  linkedSectionsByStep,
  stepsReplacedByLinked,
} from "@/components/recipes/linked-recipe-sections";
import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

import { useRecipeContext } from "../context";

export default function StepsList() {
  const context = useRecipeContext();
  const recipe = context?.recipe;
  const ingredients =
    context?.adjustedIngredients && context.adjustedIngredients.length > 0
      ? context.adjustedIngredients
      : (recipe?.recipeIngredients ?? []);
  const { tree, ingredientsFor } = useRecipeLinkedRecipes();
  const linkedByStep = linkedSectionsByStep(tree?.steps ?? []);
  const replaced = stepsReplacedByLinked(tree?.steps ?? []);

  return (
    <ReadonlyStepsList
      enableTimers
      interactive
      ingredients={ingredients}
      isStepHidden={(step) => replaced.has(step)}
      recipeId={recipe?.id}
      recipeName={recipe?.name}
      renderAfterStep={(step) =>
        linkedByStep
          .get(step)
          ?.map((section) => (
            <LinkedRecipeStepsSection
              key={section.recipe.id}
              enableTimers
              interactive
              ingredientsFor={ingredientsFor}
              section={section}
            />
          ))
      }
      steps={recipe?.steps ?? []}
      systemUsed={recipe?.systemUsed ?? "metric"}
    />
  );
}
