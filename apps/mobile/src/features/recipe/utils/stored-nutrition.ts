import type { FullRecipeDTO } from "@norish/shared/contracts";

export type NutritionFigures = {
  calories: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
};

const asNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "string" ? parseFloat(value) : value;

  return parsed == null || Number.isNaN(parsed) ? null : parsed;
};

/** The recipe's stored nutrition as numbers; null when it stores none. */
export function storedNutrition(
  recipe: Pick<FullRecipeDTO, "calories" | "fat" | "carbs" | "protein">
): NutritionFigures | null {
  const figures = {
    calories: asNumber(recipe.calories),
    fat: asNumber(recipe.fat),
    carbs: asNumber(recipe.carbs),
    protein: asNumber(recipe.protein),
  };

  return Object.values(figures).some((value) => value !== null) ? figures : null;
}
