import type { useTranslations } from "next-intl";

import type { NutritionFact } from "@norish/shared/contracts/ingredient-nutrition";
import { factSourceCopy } from "@norish/shared-react/ingredients";

type NutritionT = ReturnType<typeof useTranslations<"settings.ingredients.nutrition">>;

/** A fact's source in the panel's words, saying first where it was borrowed from. */
export function factSource<T>(t: NutritionT, fact: NutritionFact<T>): string {
  const { source, borrowedFrom } = factSourceCopy(fact);
  const text = t(source.key as Parameters<NutritionT>[0], source.values);

  return borrowedFrom ? t("borrowed", { name: borrowedFrom, source: text }) : text;
}
