import type { EditedIngredient } from "@norish/shared/lib/grocery-lines";

import type { ScaledFood } from "./use-lines-to-buy";
import { useOnTheList } from "./use-groceries-query";
import { useLineSelection } from "./use-line-selection";
import { useLinesToBuy } from "./use-lines-to-buy";

/** What a section and its rows do with a line: tick it, keep it, and tell what it already is. */
export type GroceryLineControls<T extends ScaledFood> = {
  isSelected: (id: string) => boolean;
  /** No Pantry Ingredient covers the line, so "we keep this" is offered. */
  canKeep: (item: T) => boolean;
  /** The line is kept and its food is already on the list. */
  isOnTheList: (item: T) => boolean;
  keep: (item: T) => void;
  toggle: (id: string) => void;
  toggleSection: (section: T[], other: T[]) => void;
};

/**
 * Everything a recipe's "add to groceries" sheet draws from its lines: the split by Pantry, the
 * ticks, the controls each row takes, and what adds the ticked lines.
 */
export function useGroceryLines<T extends ScaledFood>(
  lines: T[],
  editedIngredients: Record<string, EditedIngredient>
) {
  const { pantry, keptFor, keepLine, toBuy, inPantry, addLines, isAdding } = useLinesToBuy(
    lines,
    editedIngredients
  );
  const onTheList = useOnTheList(pantry.items);
  const { selectedCount, inPantrySelectedCount, isSelected, toggleSelect, toggleSection } =
    useLineSelection({
      lines,
      toBuy,
      inPantry,
      pantryLoading: pantry.isLoading,
      pantryUnavailable: pantry.isUnavailable,
    });
  const controls: GroceryLineControls<T> = {
    isSelected,
    canKeep: (item) => keptFor(item) === null,
    isOnTheList: (item) => {
      const kept = keptFor(item);

      return kept !== null && onTheList.includes(kept.id);
    },
    keep: keepLine,
    toggle: toggleSelect,
    toggleSection,
  };

  return {
    pantry,
    toBuy,
    inPantry,
    selectedCount,
    inPantrySelectedCount,
    isAdding,
    /** Puts the ticked lines on the list; true once they are on it. */
    addTicked: () => addLines(lines.filter((line) => isSelected(line.id))),
    controls,
  };
}
