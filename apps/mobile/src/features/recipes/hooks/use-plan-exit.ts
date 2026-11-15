import { useRouter } from "expo-router";

import { afterPlanningStep } from "@norish/shared-react/calendar";
import { useReader } from "@norish/shared-react/reader";
import { getAfterPlanningPreference } from "@norish/shared/lib/user-preferences";

import { useAddAtOnceStarter } from "../components/add-at-once-host";
import { useAddToGroceriesPath } from "./use-add-to-groceries-path";

/**
 * How a plan sheet leaves once it has planned: it closes, or, as the "after planning" choice asks,
 * is replaced by Add to groceries for the recipe, or closes and puts the lines on the list at once.
 */
export function usePlanExit() {
  const router = useRouter();
  const addAtOnce = useAddAtOnceStarter();
  const choice = getAfterPlanningPreference(useReader().user);
  const addToGroceries = useAddToGroceriesPath();

  return (plannedRecipeId?: string) => {
    const step = plannedRecipeId ? afterPlanningStep(choice, plannedRecipeId) : null;

    if (!step) return router.back();

    if (step.addAtOnce) {
      router.back();
      addAtOnce(step.recipeId);

      return;
    }

    router.replace({ pathname: addToGroceries, params: { recipeId: step.recipeId } });
  };
}
