import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { useGroceriesMutations } from "./use-groceries-mutations";

/** A kept food, as much of it as putting it on the list needs. */
type KeptFood = { name: string; localeNames?: LocaleNames };

/** Running out of a kept food: one grocery named as the reader reads it, no amount or Store, and
 * optimistic and queued like any grocery. Returns the name put on the list and an `undo`. */
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
