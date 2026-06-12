import type { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";
import type { RefObject } from "react";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { IngredientLinkCandidate } from "@norish/shared-react/text";
import type { MeasurementSystem } from "@norish/shared/contracts";

export type SharedRecipe = NonNullable<
  ReturnType<typeof sharedRecipeShareHooks.useSharedRecipeQuery>["recipe"]
>;

export type ShareIngredient = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

export type ShareRecipeState = {
  servings: number;
  setServings: (servings: number) => void;
  activeSystem: MeasurementSystem;
  setActiveSystem: (system: MeasurementSystem) => void;
  availableSystems: MeasurementSystem[];
  adjustedIngredients: ShareIngredient[];
};

export type PublicRecipeContextValue = {
  token: string;
  recipe: SharedRecipe;
  units: UnitsMap;
  state: ShareRecipeState;
  highlightedIngredientKey: string | null;
  ingredientListRef: RefObject<HTMLUListElement | null>;
  highlightIngredient: (candidate: IngredientLinkCandidate) => void;
};
