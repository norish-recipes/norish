import { useState } from "react";

import type { RecipeCategory, Slot } from "@norish/shared/contracts";
import { dateKey } from "@norish/shared/lib/helpers";

import { useCalendarMutations } from "./use-calendar-mutations";

/** The recipe category a slot's Random recipe draws from. */
const SLOT_TO_CATEGORY: Record<Slot, RecipeCategory> = {
  Breakfast: "Breakfast",
  Lunch: "Lunch",
  Dinner: "Dinner",
  Snack: "Snack",
};

type SlotPlanningOptions = {
  date: Date;
  /** The slot being filled; without one, a note or a random pick has no home. */
  slot?: Slot;
  /** Passed in because a domain imports no other: `useRandomRecipe` lives in recipes. */
  getRandomRecipe: (category: RecipeCategory) => Promise<{ id: string } | null>;
  /** Closes the planning sheet, as an item is planned. */
  close: () => void;
  /** Runs after an item is planned from a recipe, with its id. */
  onPlanned?: (recipeId: string) => void;
};

/**
 * What a planning sheet does for one day: plan a picked recipe, a random one for the slot, or a
 * note. Every write is the shared calendar mutation, so offline it queues in the Outbox.
 */
export function useSlotPlanning({
  date,
  slot,
  getRandomRecipe,
  close,
  onPlanned,
}: SlotPlanningOptions) {
  const { planRecipe, planNote } = useCalendarMutations();
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const day = dateKey(date);

  const plan = (recipeId: string, target: Slot) => {
    planRecipe(day, target, recipeId);
    close();
    onPlanned?.(recipeId);
  };

  return {
    isRandomLoading,
    planRecipe: (recipe: { id: string }, target: Slot) => plan(recipe.id, target),
    planRandom: () => {
      if (!slot) return Promise.resolve();
      setIsRandomLoading(true);

      return getRandomRecipe(SLOT_TO_CATEGORY[slot])
        .then((result) => {
          if (result) plan(result.id, slot);
        })
        .finally(() => setIsRandomLoading(false));
    },
    /** A note for `target`, or for the sheet's own slot; blank text plans nothing. */
    planNote: (text: string, target = slot) => {
      const title = text.trim();

      if (!title || !target) return;
      planNote(day, target, title);
      close();
    },
  };
}
