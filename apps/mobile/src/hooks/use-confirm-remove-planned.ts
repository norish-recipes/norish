import { useConfirm } from "@/hooks/use-confirm";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarMutations } from "@norish/shared-react/calendar";
import {
  getPlannedItemTitle,
  slotTranslationKeys,
} from "@norish/shared-react/calendar/todays-meals";
import { parseDateKey } from "@norish/shared/lib/helpers";

/** Removing a planned item: the native alert names it, its day and slot, and Remove is the shared
 * delete, which queues in the Outbox offline. */
export function useConfirmRemovePlanned() {
  const intl = useIntl();
  const confirm = useConfirm();
  const { deleteItem } = useCalendarMutations();

  return (item: PlannedItemFromQuery) =>
    confirm({
      title: intl.formatMessage({ id: "calendar.today.removeTitle" }),
      message: intl.formatMessage(
        { id: "calendar.today.removeMessage" },
        {
          name: getPlannedItemTitle(item, intl.formatMessage({ id: "calendar.timeline.untitled" })),
          day: intl.formatDate(parseDateKey(item.date), { weekday: "long" }),
          slot: intl
            .formatMessage({ id: `common.slots.${slotTranslationKeys[item.slot]}` })
            .toLocaleLowerCase(intl.locale),
        }
      ),
      confirmLabelId: "common.actions.remove",
      onConfirm: () => deleteItem(item.id),
    });
}
