import { successNotification } from "@/lib/haptics";

import type { PickedFood } from "@norish/shared-react/groceries";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { usePantryField } from "@norish/shared-react/groceries";

/** The Pantry field whose `keep` gives the success haptic: the one way a food is kept on mobile. */
export function useKeepingField(
  items: readonly PantryIngredientDto[],
  locale: string,
  rules: SpellingRules
) {
  const field = usePantryField(items, locale, rules);

  return {
    ...field,
    keep: (food: string | PickedFood) => {
      field.keep(food);
      successNotification();
    },
  };
}
