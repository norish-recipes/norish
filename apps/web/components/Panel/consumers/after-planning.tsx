"use client";

import type { ReactNode } from "react";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";

import type { Planned } from "@norish/shared-react/calendar";
import {
  plannedServings,
  useAfterPlanning as useSharedAfterPlanning,
} from "@norish/shared-react/calendar";
import { useRecipeQuery } from "@norish/shared-react/recipes";

/**
 * The groceries for a recipe just planned, at the recipe's own servings: the
 * panel waits for them, since it reads them only once.
 */
function PlannedGroceries({
  recipeId,
  addAtOnce,
  open,
  onOpenChange,
}: Omit<Planned, "key"> & { onOpenChange: (open: boolean) => void }) {
  const { recipe } = useRecipeQuery(recipeId);

  if (!recipe) return null;

  const servings = plannedServings(recipe);

  return (
    <MiniGroceries
      addAtOnce={addAtOnce}
      initialServings={servings}
      open={open}
      originalServings={servings}
      recipeId={recipeId}
      onOpenChange={onOpenChange}
    />
  );
}

/**
 * What happens once a recipe is planned, as the user chose in Preferences:
 * nothing, the groceries panel for it (the default), or its lines to buy
 * straight onto the list. A planning panel closes as it plans, so whoever
 * hosts it renders `afterPlanningPanel`, which outlives it.
 */
export function useAfterPlanning(): {
  afterPlanning: (recipeId: string) => void;
  afterPlanningPanel: ReactNode;
} {
  const { afterPlanning, planned, setOpen } = useSharedAfterPlanning();

  return {
    afterPlanning,
    afterPlanningPanel: planned ? (
      <PlannedGroceries
        key={planned.key}
        addAtOnce={planned.addAtOnce}
        open={planned.open}
        recipeId={planned.recipeId}
        onOpenChange={setOpen}
      />
    ) : null,
  };
}
