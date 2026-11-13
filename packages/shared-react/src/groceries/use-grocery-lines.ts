import type { EditedIngredient } from "@norish/shared/lib/grocery-lines";

import type { ScaledFood } from "./use-lines-to-buy";
import { useOnTheList } from "./use-groceries-query";
import { useLineSelection } from "./use-line-selection";
import { useLinesToBuy } from "./use-lines-to-buy";

/**
 * Everything a recipe's "add to groceries" sheet draws from its lines: the split by Pantry, which
 * kept lines are already on the list, the ticks, and what adds the ticked lines.
 */
export function useGroceryLines<T extends ScaledFood>(
  lines: T[],
  editedIngredients: Record<string, EditedIngredient>
) {
  const linesToBuy = useLinesToBuy(lines, editedIngredients);
  const { pantry, toBuy, inPantry } = linesToBuy;
  const onTheList = useOnTheList(pantry.items);
  const selection = useLineSelection({
    lines,
    toBuy,
    inPantry,
    pantryLoading: pantry.isLoading,
    pantryUnavailable: pantry.isUnavailable,
  });

  return { ...linesToBuy, onTheList, ...selection };
}
