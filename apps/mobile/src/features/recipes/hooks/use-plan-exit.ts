import { useRouter } from "expo-router";

import { afterPlanningStep } from "@norish/shared-react/calendar";
import { useReader } from "@norish/shared-react/reader";
import { getAfterPlanningPreference } from "@norish/shared/lib/user-preferences";

/**
 * How a plan sheet leaves once it has planned: it closes, or, as the "after planning" choice asks,
 * is replaced by Add to groceries for the recipe (which adds at once when the choice says so).
 */
export function usePlanExit() {
  const router = useRouter();
  const choice = getAfterPlanningPreference(useReader().user);

  return (plannedRecipeId?: string) => {
    const step = plannedRecipeId ? afterPlanningStep(choice, plannedRecipeId) : null;

    if (!step) return router.back();

    router.replace({
      pathname: "/add-to-groceries",
      params: { recipeId: step.recipeId, ...(step.addAtOnce ? { addAtOnce: "1" } : {}) },
    });
  };
}
