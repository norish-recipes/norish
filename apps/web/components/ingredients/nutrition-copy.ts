import type { useTranslations } from "next-intl";

import type { NutritionFact, NutritionSource } from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import { NUTRITION_CREDIT_NAMES } from "@norish/shared/contracts/ingredient-nutrition";

type NutritionT = ReturnType<typeof useTranslations<"settings.ingredients.nutrition">>;

const SPOON_KEYS = {
  teaspoon: "teaspoon",
  tablespoon: "tablespoon",
  cup: "cup",
  "100ml": "hundredMl",
} as const satisfies Record<SpoonMeasure, string>;

/**
 * A measure's key among the panel's words ("spoon.teaspoon", "100 ml"): a
 * density is shown and corrected as what that measure weighs, never as
 * grams per millilitre.
 */
export function spoonKey(measure: SpoonMeasure): (typeof SPOON_KEYS)[SpoonMeasure] {
  return SPOON_KEYS[measure];
}

/**
 * Where a fact came from, in the panel's words: the dataset food and its
 * dataset ("Onion, raw · CIQUAL 2025"), and how it was chosen where that
 * matters. A household's own numbers are never shown as a dataset's.
 */
export function sourceText(t: NutritionT, source: NutritionSource): string {
  switch (source.kind) {
    case "household":
      return t("source.household");
    case "taxonomy":
      return t("source.taxonomy");
    case "household-food":
      return t("source.householdFood", {
        food: source.food.name,
        dataset: NUTRITION_CREDIT_NAMES[source.food.dataset],
      });
    default:
      return t(`source.${source.kind}`, {
        food: source.food.name,
        dataset: NUTRITION_CREDIT_NAMES[source.food.dataset],
      });
  }
}

/** A fact's source, saying first where it was borrowed from. */
export function factSource<T>(t: NutritionT, fact: NutritionFact<T>): string {
  const source = sourceText(t, fact.source);

  return fact.borrowedFrom ? t("borrowed", { name: fact.borrowedFrom.name, source }) : source;
}
