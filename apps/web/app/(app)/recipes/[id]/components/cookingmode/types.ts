import type { PointerEvent } from "react";

import type { ResolvedCookingModeStep } from "./cooking-mode-steps";

/** Which of cooking mode's two views is on screen. */
export type CookingModeView = "steps" | "ingredients";

export type IngredientLike = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

/** What cooking mode needs to know about the recipe it is cooking. */
export type CookingModeRecipe = {
  id: string;
  name: string;
  /** The recipe's first image, for the header's thumbnail. */
  image: string | null;
  categories: string[];
  totalMinutes: number | null;
  servings?: number | null;
  systemUsed: string;
};

export type CookingModeDialogProps = {
  activeStep: number;
  activeView: CookingModeView;
  displayIngredients: IngredientLike[];
  recipe: CookingModeRecipe;
  steps: ResolvedCookingModeStep[];
  /**
   * Ready At: the Cooking Session's start plus the recipe's total time,
   * fixed when cooking mode opened. A projection, never a promise — and
   * absent entirely for a recipe with no total time.
   */
  readyAt: Date | null;
  areTimersOpen: boolean;
  onClose: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onStepChange: (step: number) => void;
  onViewChange: (view: CookingModeView) => void;
  onTimersOpenChange: (open: boolean) => void;
  checkedIngredients: Set<number>;
  onCheckedIngredientsChange: (indices: Set<number>) => void;
};
