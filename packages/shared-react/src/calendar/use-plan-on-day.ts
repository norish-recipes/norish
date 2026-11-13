import type { Slot } from "@norish/shared/contracts";

import { useCalendarMutations } from "./use-calendar-mutations";

type PlanOnDayOptions = {
  /** The recipe being planned; nothing is planned until it has loaded. */
  recipe: { id: string } | null | undefined;
  /** Closes the planning calendar, as the recipe is planned. */
  close: (plannedRecipeId?: string) => void;
  /** Runs after the recipe is planned, with its id. */
  onPlanned?: (recipeId: string) => void;
};

/** The plan step of a planning calendar: the known recipe goes on a day's slot. Offline it queues in the Outbox. */
export function usePlanOnDay({ recipe, close, onPlanned }: PlanOnDayOptions) {
  const { planRecipe } = useCalendarMutations();

  return (dayKey: string, slot: Slot) => {
    if (!recipe) return;
    planRecipe(dayKey, slot, recipe.id);
    close(recipe.id);
    onPlanned?.(recipe.id);
  };
}
