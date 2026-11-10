"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { MiniGroceries } from "@/features/groceries";
import { useQuery } from "@tanstack/react-query";

import { useRecipeQuery } from "@norish/shared-react/recipes";
import { useTRPC } from "@norish/shared-react/trpc";
import { getAfterPlanningPreference } from "@norish/shared/lib/user-preferences";

type Planned = { key: number; recipeId: string; addAtOnce: boolean; open: boolean };

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

  const servings = recipe.servings || 1;

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
 * hosts it renders `afterPlanningPanel`, which outlives it. The choice is read while the planning
 * panel is `open`, the only time it plans.
 */
export function useAfterPlanning(open: boolean): {
  afterPlanning: (recipeId: string) => void;
  afterPlanningPanel: ReactNode;
} {
  const trpc = useTRPC();
  const { data: choice = getAfterPlanningPreference(null) } = useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: open,
    select: (data) => getAfterPlanningPreference(data.user),
  });
  const [planned, setPlanned] = useState<Planned | null>(null);

  const afterPlanning = useCallback(
    (recipeId: string) => {
      if (choice === "nothing") return;
      setPlanned((prev) => ({
        key: (prev?.key ?? 0) + 1,
        recipeId,
        addAtOnce: choice === "addGroceries",
        open: choice === "openGroceries",
      }));
    },
    [choice]
  );
  const handleOpenChange = useCallback(
    (open: boolean) => setPlanned((prev) => prev && { ...prev, open }),
    []
  );

  return {
    afterPlanning,
    afterPlanningPanel: planned ? (
      <PlannedGroceries
        key={planned.key}
        addAtOnce={planned.addAtOnce}
        open={planned.open}
        recipeId={planned.recipeId}
        onOpenChange={handleOpenChange}
      />
    ) : null,
  };
}
