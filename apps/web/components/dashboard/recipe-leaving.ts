import { useEffect } from "react";
import { create } from "zustand";

/** The card's delete animation, start to finish (SwipeableRow's commitDelete). */
const LEAVE_MS = 500;

type RecipeLeavingState = {
  /** The cards playing their way out after a bulk delete. */
  leaving: ReadonlySet<string>;
  /** Play the delete animation on these cards where they are on screen, then run `then`. */
  playLeaving: (recipeIds: string[], then: () => void) => void;
};

export const useRecipeLeaving = create<RecipeLeavingState>()((set) => ({
  leaving: new Set(),
  playLeaving: (recipeIds, then) => {
    set({ leaving: new Set(recipeIds) });
    // The timer outlives the page: the delete must still go out if the reader leaves.
    setTimeout(() => {
      then();
      set({ leaving: new Set() });
    }, LEAVE_MS);
  },
}));

/** The animation ends with the caller's page, so a card on the next page never plays it. */
export function useLeavingEndsOnUnmount(): void {
  useEffect(() => () => useRecipeLeaving.setState({ leaving: new Set() }), []);
}
