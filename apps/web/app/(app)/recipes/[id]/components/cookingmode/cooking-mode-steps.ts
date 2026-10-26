"use client";

import type {
  StepIngredientLineLike,
  StepIngredientRefLike,
} from "@norish/shared/lib/step-ingredients";

export type CookingModeStepImage = {
  image: string;
  order?: number;
};

export type CookingModeStepLike = {
  step: string;
  systemUsed: string;
  order: number;
  images?: CookingModeStepImage[];
  stepIngredients?: StepIngredientRefLike[];
};

/** The linked recipe a cooking step comes from, with what its step needs to read right. */
export type CookingModeLinkedRecipe = {
  recipeId: string;
  recipeName: string;
  /** 1 for a recipe linked from the one being cooked, 2 for one linked from that, … */
  depth: number;
  /** The system its steps and lines are read in. */
  systemUsed: string;
  /** Its own lines, which its steps' ingredient chips resolve against. */
  ingredients: (StepIngredientLineLike & { ingredientId?: string | null })[];
};

/** A linked recipe to cook in place, right after the step that links it. */
export type CookingModeLinkedSection = CookingModeLinkedRecipe & {
  steps: CookingModeStepLike[];
};

export type ResolvedCookingModeStep = {
  /** The step's place among its own recipe's rows (headings included). */
  originalIndex: number;
  stepNumber: number;
  text: string;
  heading?: string;
  images: CookingModeStepImage[];
  stepIngredients: StepIngredientRefLike[];
  /** Set on a step that comes from a linked recipe rather than the one being cooked. */
  linkedFrom?: CookingModeLinkedRecipe;
};

/**
 * Cooking mode's steps, in cooking order: headings fold onto the steps under
 * them, and each linked recipe's steps follow the step that links it, so
 * making the dough is part of making the pizza. `linkedAfter` names the
 * linked recipes that expand after a step, at any depth; `isReplaced` names a
 * step that only names them, which is left out for the linked steps that
 * follow it.
 */
export function resolveCookingModeSteps(
  steps: CookingModeStepLike[],
  systemUsed: string,
  linkedAfter?: (step: CookingModeStepLike) => CookingModeLinkedSection[],
  isReplaced?: (step: CookingModeStepLike) => boolean
): ResolvedCookingModeStep[] {
  const resolved: ResolvedCookingModeStep[] = [];

  const resolveRecipe = (
    recipeSteps: CookingModeStepLike[],
    recipeSystem: string,
    linkedFrom: CookingModeLinkedRecipe | undefined
  ) => {
    const filteredSteps = recipeSteps
      .filter((step) => step.systemUsed === recipeSystem)
      .sort((a, b) => a.order - b.order);

    // A heading belongs to the recipe it is written in: it neither leaks
    // into a linked recipe's steps nor survives past them.
    let heading: string | undefined;
    let pendingHeadingImages: CookingModeStepImage[] = [];

    filteredSteps.forEach((step, originalIndex) => {
      const text = step.step.trim();
      const images = [...(step.images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (text.startsWith("#")) {
        heading = text.replace(/^#+\s*/, "");
        pendingHeadingImages = images;
      } else if (!isReplaced?.(step)) {
        resolved.push({
          originalIndex,
          stepNumber: resolved.length + 1,
          text: step.step,
          heading,
          images: pendingHeadingImages.length > 0 ? [...pendingHeadingImages, ...images] : images,
          stepIngredients: step.stepIngredients ?? [],
          ...(linkedFrom ? { linkedFrom } : {}),
        });
        pendingHeadingImages = [];
      }

      for (const { steps: linkedSteps, ...linkedRecipe } of linkedAfter?.(step) ?? []) {
        resolveRecipe(linkedSteps, linkedRecipe.systemUsed, linkedRecipe);
      }
    });
  };

  resolveRecipe(steps, systemUsed, undefined);

  return resolved;
}
