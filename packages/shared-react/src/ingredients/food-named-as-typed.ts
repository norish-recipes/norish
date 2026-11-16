import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { foodKey } from "@norish/shared/lib/spelling-keys";

/** The found food named `typed` as its row shows it: the spelling rule the Pantry field's `canAdd`
 * uses, so a custom entry is never offered beside the food it would repeat. */
export function foodNamedAsTyped<T extends { name: string; localeNames?: LocaleNames }>(
  typed: string,
  foods: readonly T[],
  locale: string,
  rules: SpellingRules
): T | undefined {
  const key = foodKey(typed, rules);

  return key === ""
    ? undefined
    : foods.find((food) => foodKey(ingredientDisplayName(food, locale), rules) === key);
}
