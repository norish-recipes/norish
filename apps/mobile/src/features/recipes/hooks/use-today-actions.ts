import { useConfirmRemovePlanned } from "@/hooks/use-confirm-remove-planned";
import { recipeRoute, TAB_ROUTES } from "@/lib/tab-routes";
import { useRouter } from "expo-router";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { isRecipeItem } from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";

import type { TodayMenuAction } from "../utils/today-actions";

/**
 * What one Today card does and where it goes: the handlers for its menu and tap, and the
 * destination the long-press preview shows. Remove confirms, then is the shared mutation.
 */
export function useTodayActions(item: PlannedItemFromQuery) {
  const router = useRouter();
  const { navigation } = usePlatform();
  const confirmRemove = useConfirmRemovePlanned();
  const isRecipe = isRecipeItem(item);

  const handlers: Record<TodayMenuAction, () => void> = {
    open: () => (isRecipe ? navigation.toRecipe(item.recipeId) : router.navigate("/calendar")),
    move: () =>
      router.push({
        pathname: TAB_ROUTES.recipes.move,
        params: { plannedItemId: item.id, date: item.date },
      }),
    remove: () => confirmRemove(item),
  };
  const href = isRecipe ? recipeRoute(item.recipeId) : ("/calendar" as const);

  return { isRecipe, handlers, href };
}
