import type { NutritionFact } from "@norish/shared/contracts/ingredient-nutrition";
import { factSourceCopy } from "@norish/shared-react/ingredients";

type Text = (id: string, values?: Record<string, string | number>) => string;

/** A fact's source in words, saying first where it was borrowed from. */
export function factSourceText<T>(text: Text, fact: NutritionFact<T>): string {
  const { source, borrowedFrom } = factSourceCopy(fact);
  const line = text(`settings.ingredients.nutrition.${source.key}`, source.values);

  return borrowedFrom
    ? text("settings.ingredients.nutrition.borrowed", { name: borrowedFrom, source: line })
    : line;
}
