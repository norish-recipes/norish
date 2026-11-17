import React from "react";
import { MoveFields } from "@/components/move-fields";
import { PlannedItemSkeleton } from "@/components/planned-item-skeleton";
import { Sheet, SheetBody } from "@/components/sheet";
import { useCloseWhenGone } from "@/hooks/use-close-when-gone";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import {
  useCalendarQuery,
  usePlannedItemDraft,
  usePlannedItemText,
} from "@norish/shared-react/calendar";
import { slotTranslationKeys } from "@norish/shared-react/calendar/todays-meals";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

/** Move from Today: the planned item named by the route's `plannedItemId`, on its `date`. */
export function MovePlannedItemScreen() {
  const { plannedItemId, date } = useLocalSearchParams<{ plannedItemId: string; date: string }>();
  const { calendarData, isRead } = useCalendarQuery({ startISO: date, endISO: date });
  const item = calendarData[date]?.find((candidate) => candidate.id === plannedItemId);

  useCloseWhenGone(isRead && !item);

  return item ? <MoveSheet item={item} /> : <PlannedItemSkeleton name="move" />;
}

/** The shared move fields as a draft: Save moves the item last in its new slot, Close leaves it. */
function MoveSheet({ item }: { item: PlannedItemFromQuery }) {
  const intl = useIntl();
  const router = useRouter();
  const { title } = usePlannedItemText()(item);
  const { draft, changes, setDate, setSlot, save } = usePlannedItemDraft(item);

  return (
    <Sheet
      confirm={{
        label: intl.formatMessage({ id: "common.actions.save" }),
        disabled: !changes,
        onPress: () => {
          save();
          router.back();
        },
      }}
      name="move"
      subtitle={intl.formatMessage(
        { id: "calendar.today.moveSubtitle" },
        {
          name: title,
          slot: intl
            .formatMessage({ id: `common.slots.${slotTranslationKeys[item.slot]}` })
            .toLocaleLowerCase(intl.locale),
        }
      )}
      title={intl.formatMessage({ id: "calendar.today.moveTitle" })}
    >
      <SheetBody>
        <MoveFields
          date={parseDateKey(draft.date)}
          slot={draft.slot}
          testID="move"
          onDateChange={(day) => setDate(dateKey(day))}
          onSlotChange={setSlot}
        />
      </SheetBody>
    </Sheet>
  );
}
