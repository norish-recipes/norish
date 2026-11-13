import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarMutations } from "@norish/shared-react/calendar";
import {
  getPlannedItemTitle,
  isRecipeItem,
  slotTranslationKeys,
} from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";
import { parseDateKey } from "@norish/shared/lib/helpers";

import type { TodayMenuAction } from "../utils/today-actions";
import { useConfirm } from "./use-confirm";

/**
 * What one Today card does and where it goes: the handlers for its menu and tap, and the
 * destination the long-press preview shows. Remove is the shared mutation, so offline it queues.
 */
export function useTodayActions(item: PlannedItemFromQuery) {
  const intl = useIntl();
  const router = useRouter();
  const { navigation } = usePlatform();
  const { deleteItem } = useCalendarMutations();
  const confirm = useConfirm();
  const isRecipe = isRecipeItem(item);

  const handlers: Record<TodayMenuAction, () => void> = {
    open: () => (isRecipe ? navigation.toRecipe(item.recipeId) : router.navigate("/calendar")),
    move: () => router.push({ pathname: "/plan", params: { plannedItemId: item.id } }),
    remove: () =>
      confirm({
        title: intl.formatMessage({ id: "calendar.today.removeTitle" }),
        message: intl.formatMessage(
          { id: "calendar.today.removeMessage" },
          {
            name: getPlannedItemTitle(
              item,
              intl.formatMessage({ id: "calendar.timeline.untitled" })
            ),
            day: intl.formatDate(parseDateKey(item.date), { weekday: "long" }),
            slot: intl
              .formatMessage({ id: `common.slots.${slotTranslationKeys[item.slot]}` })
              .toLocaleLowerCase(intl.locale),
          }
        ),
        confirmLabelId: "common.actions.remove",
        onConfirm: () => deleteItem(item.id),
      }),
  };
  const href = isRecipe
    ? ({ pathname: "/recipe/[id]", params: { id: item.recipeId } } as const)
    : ("/calendar" as const);

  return { isRecipe, handlers, href };
}
