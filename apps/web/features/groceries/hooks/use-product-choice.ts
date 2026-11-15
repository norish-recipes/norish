"use client";

import type { StoreDto } from "@norish/shared/contracts";
import {
  useProductChoice as useHeldProductChoice,
  useParsedGroceryName,
  useSettledName,
} from "@norish/shared-react/groceries";
import { useIngredientFor } from "@norish/shared-react/ingredients";

/** What both grocery panels hold of a Store Product: the shared choice, for the field's own text. */
export function useProductChoice(options: {
  /** The raw text of the panel's own field: "2 kg oude kaas". */
  itemName: string;
  stores: StoreDto[];
  selectedStoreId: string | null;
  /** Reopened, or opened on a different grocery: the held choice is not that grocery's. */
  resetOn?: unknown;
  /** The grocery the panel edits, as it is saved; none for a new one. */
  grocery?: { name: string | null; ingredientId?: string | null } | null;
}) {
  const { itemName, grocery, ...rest } = options;
  const groceryName = useParsedGroceryName(itemName);
  const settledName = useSettledName(groceryName);
  const ingredientId = useIngredientFor(groceryName, settledName, grocery);

  return {
    ...useHeldProductChoice({ ...rest, groceryName, settledName, ingredientId }),
    ingredientId,
  };
}
