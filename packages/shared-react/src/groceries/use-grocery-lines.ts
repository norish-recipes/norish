import type { EditedIngredient } from "@norish/shared/lib/grocery-lines";

import type { BringSource, ScaledFood } from "./use-lines-to-buy";
import { useBringHandoff } from "./use-bring-handoff";
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
 * ticks, the controls each row takes, and what adds the ticked lines. Where the list is Bring!, the
 * ticked lines are kept in a prepared Bring Handoff while the sheet is open, and adding opens it.
 */
export function useGroceryLines<T extends ScaledFood>(
  lines: T[],
  editedIngredients: Record<string, EditedIngredient>,
  source?: BringSource
) {
  const {
    pantry,
    keptFor,
    keepLine,
    toBuy,
    inPantry,
    addLines,
    toBringLines,
    isAdding,
    isBring,
    isProviderLoading,
  } = useLinesToBuy(lines, editedIngredients, source);
  const onTheList = useOnTheList(pantry.items);
  const { selectedCount, inPantrySelectedCount, isSelected, toggleSelect, toggleSection } =
    useLineSelection({
      lines,
      toBuy,
      inPantry,
      pantryLoading: pantry.isLoading,
      pantryUnavailable: pantry.isUnavailable,
    });
  const ticked = lines.filter((line) => isSelected(line.id));
  const bring = useBringHandoff({
    // The ticks settle once the Pantry has answered; a handoff prepared before that is changed at once.
    enabled: isBring && !pantry.isLoading,
    items: isBring ? toBringLines(ticked) : [],
    context: { recipeId: source?.recipeId, servings: source?.servings },
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
    /** The lines are on their way: to the built-in list, or into the Bring Handoff before it can open. */
    isAdding: isBring ? bring.status === "preparing" : isAdding,
    /** True until the instance has said which list this is; an add waits for it. */
    isProviderLoading,
    /**
     * Puts the ticked lines on the list; true once they are on it. Where the list is Bring!, opens
     * the prepared handoff from the press itself, or tries again one that failed.
     */
    addTicked: () => (isBring ? Promise.resolve(bring.open()) : addLines(ticked)),
    controls,
  };
}
