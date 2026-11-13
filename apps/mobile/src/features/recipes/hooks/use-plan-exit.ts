import { useRouter } from "expo-router";

import { afterPlanningStep } from "@norish/shared-react/calendar";
import { useReader } from "@norish/shared-react/reader";
import { getAfterPlanningPreference } from "@norish/shared/lib/user-preferences";

import { useAddAtOnceStarter } from "../components/add-at-once-host";

/**
 * How a plan sheet leaves once it has planned: it closes, or, as the "after planning" choice asks,
 * is replaced by Add to groceries for the recipe, or closes and puts the lines on the list at once.
 */
export function usePlanExit() {
  const router = useRouter();
  const addAtOnce = useAddAtOnceStarter();
  const choice = getAfterPlanningPreference(useReader().user);

  return (plannedRecipeId?: string) => {
    const step = plannedRecipeId ? afterPlanningStep(choice, plannedRecipeId) : null;

    if (!step) return router.back();

    if (step.addAtOnce) {
      router.back();
      addAtOnce(step.recipeId);

      return;
    }

    router.replace({ pathname: "/add-to-groceries", params: { recipeId: step.recipeId } });
  };
}
