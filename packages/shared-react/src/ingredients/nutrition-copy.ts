import type { NutritionFact, NutritionSource } from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import { NUTRITION_CREDIT_NAMES } from "@norish/shared/contracts/ingredient-nutrition";

const SPOON_KEYS = {
  teaspoon: "teaspoon",
  tablespoon: "tablespoon",
  cup: "cup",
  "100ml": "hundredMl",
} as const satisfies Record<SpoonMeasure, string>;

/**
 * A measure's key among the nutrition words ("spoon.teaspoon", "100 ml"): a density is shown and
 * corrected as what that measure weighs, never as grams per millilitre.
 */
export function spoonKey(measure: SpoonMeasure): (typeof SPOON_KEYS)[SpoonMeasure] {
  return SPOON_KEYS[measure];
}

/** A copy key under `settings.ingredients.nutrition` and its values. */
export interface NutritionCopy {
  key: string;
  values: Record<string, string>;
}

/**
 * Where a fact came from: the dataset food and its dataset ("Onion, raw · CIQUAL 2025"), and how
 * it was chosen where that matters. A household's own numbers are never shown as a dataset's.
 */
export function sourceCopy(source: NutritionSource): NutritionCopy {
  switch (source.kind) {
    case "household":
    case "taxonomy":
    case "ai":
      return { key: `source.${source.kind}`, values: {} };
    case "household-food":
      return {
        key: "source.householdFood",
        values: { food: source.food.name, dataset: NUTRITION_CREDIT_NAMES[source.food.dataset] },
      };
    default:
      return {
        key: `source.${source.kind}`,
        values: { food: source.food.name, dataset: NUTRITION_CREDIT_NAMES[source.food.dataset] },
      };
  }
}

/** A fact's source, saying first where it was borrowed from: `borrowed` carries `source` as text once the app has it. */
export function factSourceCopy<T>(fact: NutritionFact<T>) {
  return { source: sourceCopy(fact.source), borrowedFrom: fact.borrowedFrom?.name ?? null };
}
