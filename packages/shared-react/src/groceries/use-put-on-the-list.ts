import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { useGroceriesMutations } from "./use-groceries-mutations";

/** A kept food, as much of it as putting it on the list needs. */
type KeptFood = { name: string; localeNames?: LocaleNames };

/**
 * Running out of a kept food: one grocery for it, named as the reader reads the food, with no
 * amount and no Store. Optimistic and queued offline like any grocery; the food stays kept.
 * Returns the name put on the list and `undo`, which deletes the grocery made.
 */
export function usePutOnTheList(
  locale: string
): (food: KeptFood) => { name: string; undo: () => void } {
  const { createGroceriesFromData, deleteGroceries } = useGroceriesMutations();

  return (food) => {
    const name = ingredientDisplayName(food, locale);
    // A failed create says so itself, and puts the list back.
    const created = createGroceriesFromData([{ name, amount: null, unit: null }]);

    created.catch(() => undefined);

    return { name, undo: () => void created.then(deleteGroceries, () => undefined) };
  };
}
