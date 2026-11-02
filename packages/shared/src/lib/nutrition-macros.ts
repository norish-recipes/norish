/**
 * A recipe's macros as calorie contribution.
 *
 * Fat carries 9 calories per gram, carbohydrate and protein 4 — so a gram
 * share and a calorie share are different pictures of the same recipe, and
 * only the calorie one is talking about the same quantity as the calorie
 * figure beside it. The figure itself is never computed from here: a recipe's
 * calories are whatever it stores, and the arcs and the centre are allowed to
 * disagree.
 */

export type MacroKey = "fat" | "carbs" | "protein";

export type MacroCalorieShare = {
  key: MacroKey;
  grams: number;
  /** Calories this macro contributes, at 9/4/4 per gram. */
  calories: number;
  /** This macro's fraction of the macros' own calorie sum, in [0, 1]. */
  share: number;
};

const CALORIES_PER_GRAM: Record<MacroKey, number> = {
  fat: 9,
  carbs: 4,
  protein: 4,
};

/** The order the arcs and the legend are drawn in. */
const MACRO_ORDER: MacroKey[] = ["fat", "carbs", "protein"];

function storedGrams(value: number | string | null | undefined): number | null {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;

  if (parsed == null || !Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

/**
 * The macros a recipe stores, as their share of the calories they account
 * for. A macro the recipe does not store gets no entry, so a partial set
 * draws only the arcs that exist; a recipe storing no macros at all — or
 * storing only zeroes — gets no entries and therefore no ring.
 */
export function macroCalorieShares(macros: {
  fat?: number | string | null;
  carbs?: number | string | null;
  protein?: number | string | null;
}): MacroCalorieShare[] {
  const stored = MACRO_ORDER.map((key) => ({ key, grams: storedGrams(macros[key]) })).filter(
    (entry): entry is { key: MacroKey; grams: number } => entry.grams != null
  );

  const withCalories = stored.map(({ key, grams }) => ({
    key,
    grams,
    calories: grams * CALORIES_PER_GRAM[key],
  }));

  const total = withCalories.reduce((sum, entry) => sum + entry.calories, 0);

  if (total <= 0) return [];

  return withCalories.map((entry) => ({ ...entry, share: entry.calories / total }));
}
