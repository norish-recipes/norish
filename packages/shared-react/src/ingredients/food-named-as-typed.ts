import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { textNamesFood } from "@norish/shared/lib/pantry";

/** The found food `typed` names, by the rule the Pantry field's `canAdd` uses: any of its names,
 * plurals and a note counted, so a custom entry is never offered beside the food it would repeat. */
export function foodNamedAsTyped<T extends { name: string; localeNames?: LocaleNames }>(
  typed: string,
  foods: readonly T[],
  rules: SpellingRules
): T | undefined {
  return foods.find((food) => textNamesFood(typed, food, rules));
}
