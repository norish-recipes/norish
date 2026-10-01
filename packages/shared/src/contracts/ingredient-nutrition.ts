/**
 * Ingredient Nutrition as the server answers it (ADR-0039): an Ingredient's
 * numbers per 100 g, its piece weight and its density, each with where it
 * came from, for one household.
 */

/** The datasets a number can come from; `off` is Open Food Facts' own piece weights and densities. */
export const NUTRITION_CREDITS = [
  "ciqual",
  "ciqual-2020",
  "calnut",
  "usda",
  "cofid",
  "off",
] as const;

export type NutritionCredit = (typeof NUTRITION_CREDITS)[number];

/** How each source is credited: a name and edition, never translated. */
export const NUTRITION_CREDIT_NAMES: Record<NutritionCredit, string> = {
  ciqual: "CIQUAL 2025",
  "ciqual-2020": "CIQUAL 2020",
  calnut: "CALNUT 2020",
  usda: "USDA FoodData Central",
  cofid: "CoFID 2021",
  off: "Open Food Facts",
};

/** One dataset food: what a number was taken from, in the dataset's own words. */
export interface NutritionFoodRef {
  dataset: Exclude<NutritionCredit, "off">;
  code: string;
  name: string;
}

/**
 * Where one fact came from, first hit of the lookup order winning:
 * - `household`: the household's own correction, typed from a label;
 * - `household-food`: the household's correction, a dataset food it picked;
 * - `fix`: a dataset food Norish chose for this food (its fix list);
 * - `code`: the dataset food the taxonomy's code for this food names;
 * - `name`: a dataset food matched by name when the build script ran;
 * - `taxonomy`: Open Food Facts' own piece weight or density.
 */
export type NutritionSource =
  | { kind: "household" }
  | { kind: "household-food"; food: NutritionFoodRef }
  | { kind: "fix"; food: NutritionFoodRef }
  | { kind: "code"; food: NutritionFoodRef }
  | { kind: "name"; food: NutritionFoodRef }
  | { kind: "taxonomy" };

/** The four numbers per 100 g. */
export interface Per100g {
  kcal: number;
  fat: number;
  carbs: number;
  protein: number;
}

/** One fact, where it came from, and the parent it was borrowed from, if it was. */
export interface NutritionFact<T> {
  value: T;
  source: NutritionSource;
  borrowedFrom: { id: string; name: string } | null;
}

/** What Norish knows about an Ingredient's nutrition for one household; null where nothing. */
export interface IngredientNutrition {
  numbers: NutritionFact<Per100g> | null;
  /** Grams one piece weighs. */
  pieceWeight: NutritionFact<number> | null;
  /** Grams per millilitre. */
  density: NutritionFact<number> | null;
}

/** Which dataset a fact credits, or null for the household's own numbers. */
export function creditOf(source: NutritionSource): NutritionCredit | null {
  switch (source.kind) {
    case "household":
      return null;
    case "taxonomy":
      return "off";
    default:
      return source.food.dataset;
  }
}
