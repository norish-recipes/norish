import type { PointerEvent } from "react";

import type { ResolvedCookingModeStep } from "./cooking-mode-steps";

export type CookingModeTab = "steps" | "ingredients";

export type IngredientLike = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

export type CookingModeDialogProps = {
  activeStep: number;
  activeTab: CookingModeTab;
  displayIngredients: IngredientLike[];
  recipeId: string;
  recipeName: string;
  recipeServings?: number | null;
  recipeSystemUsed: string;
  steps: ResolvedCookingModeStep[];
  onClose: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onStepChange: (step: number) => void;
  onTabChange: (tab: CookingModeTab) => void;
};
