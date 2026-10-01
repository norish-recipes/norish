import type { useTranslations } from "next-intl";

import type { NutritionFact, NutritionSource } from "@norish/shared/contracts/ingredient-nutrition";
import { NUTRITION_CREDIT_NAMES } from "@norish/shared/contracts/ingredient-nutrition";

type NutritionT = ReturnType<typeof useTranslations<"settings.ingredients.nutrition">>;

/** A cup, in millilitres: how a density is shown and corrected, never as grams per millilitre. */
export const CUP_ML = 240;

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
