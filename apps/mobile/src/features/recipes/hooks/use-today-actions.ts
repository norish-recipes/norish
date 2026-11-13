import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarMutations } from "@norish/shared-react/calendar";
import {
  getPlannedItemTitle,
  slotTranslationKeys,
} from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";
import { parseDateKey } from "@norish/shared/lib/helpers";

import { useConfirm } from "./use-confirm";

/** What a Today card can do; Remove is the shared mutation, so offline it queues in the Outbox. */
export function useTodayActions() {
  const intl = useIntl();
  const router = useRouter();
  const { navigation } = usePlatform();
  const { deleteItem } = useCalendarMutations();
  const confirm = useConfirm();

  return {
    open: (item: PlannedItemFromQuery) =>
      item.recipeId ? navigation.toRecipe(item.recipeId) : router.navigate("/calendar"),
    move: (item: PlannedItemFromQuery) =>
      router.push({ pathname: "/plan", params: { plannedItemId: item.id } }),
    remove: (item: PlannedItemFromQuery) =>
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
}

export type TodayActions = ReturnType<typeof useTodayActions>;
