import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";

import { useGroceriesMutations } from "./use-groceries-mutations";

/**
 * What saving and deleting a grocery's edit write, whether the grocery repeats or not: a repeating
 * one updates its repeat, a plain one that gains a repeat becomes one, and a plain edit updates.
 */
export function useGroceryEdit(grocery: GroceryDto, recurringGrocery: RecurringGroceryDto | null) {
  const {
    deleteGroceries,
    createRecurringGrocery,
    updateGrocery,
    updateRecurringGrocery,
    deleteRecurringGrocery,
  } = useGroceriesMutations();

  const save = (
    itemName: string,
    pattern: RecurrencePattern | null,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => {
    if (recurringGrocery) {
      // Already recurring - update the recurring grocery (store change included)
      updateRecurringGrocery(
        recurringGrocery.id,
        grocery.id,
        itemName,
        pattern,
        storeId,
        purchaseAmount
      );
    } else if (pattern) {
      // Convert regular grocery to recurring without racing an update against the delete.
      createRecurringGrocery(
        itemName,
        pattern,
        storeId !== undefined ? storeId : grocery.storeId,
        purchaseAmount
      );
      deleteGroceries([grocery.id]);
    } else {
      // Simple update
      updateGrocery(grocery.id, itemName, storeId, purchaseAmount);
    }
  };
  const remove = () => {
    if (recurringGrocery) {
      deleteRecurringGrocery(recurringGrocery.id);
    } else {
      deleteGroceries([grocery.id]);
    }
  };

  return { save, remove };
}
