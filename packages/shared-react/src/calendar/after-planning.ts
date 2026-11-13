import { useState } from "react";

import { getAfterPlanningPreference } from "@norish/shared/lib/user-preferences";

import { useReader } from "../reader";

export type Planned = { key: number; recipeId: string; addAtOnce: boolean; open: boolean };

/** What the "after planning" choice asks for once a recipe is planned; nothing for "nothing". */
export function afterPlanningStep(
  choice: ReturnType<typeof getAfterPlanningPreference>,
  recipeId: string
): Omit<Planned, "key"> | null {
  if (choice === "nothing") return null;

  return { recipeId, addAtOnce: choice === "addGroceries", open: choice === "openGroceries" };
}

/** The servings the groceries for a planned recipe start from: its own. */
export function plannedServings(recipe: { servings?: number | null }) {
  return recipe.servings || 1;
}

/**
 * What happens once a recipe is planned, as the user chose in Preferences: nothing, the groceries
 * panel for it (the default), or its lines to buy straight onto the list. A planning panel closes
 * as it plans, so whoever hosts it renders what `planned` describes, which outlives it.
 */
export function useAfterPlanning(): {
  afterPlanning: (recipeId: string) => void;
  planned: Planned | null;
  setOpen: (open: boolean) => void;
} {
  const choice = getAfterPlanningPreference(useReader().user);
  const [planned, setPlanned] = useState<Planned | null>(null);

  return {
    afterPlanning: (recipeId) => {
      const step = afterPlanningStep(choice, recipeId);

      if (step) setPlanned((prev) => ({ key: (prev?.key ?? 0) + 1, ...step }));
    },
    planned,
    setOpen: (open) => setPlanned((prev) => prev && { ...prev, open }),
  };
}
