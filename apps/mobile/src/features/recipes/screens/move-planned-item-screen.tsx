import React from "react";
import { MoveFields } from "@/components/move-fields";
import { PlannedItemSkeleton } from "@/components/planned-item-skeleton";
import { Sheet, SheetBody } from "@/components/sheet";
import { useCloseWhenGone } from "@/hooks/use-close-when-gone";
import { usePlannedItemSheet } from "@/hooks/use-planned-item-sheet";
import { useLocalSearchParams } from "expo-router";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarQuery, usePlannedItemText } from "@norish/shared-react/calendar";

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
  const { title } = usePlannedItemText()(item);
  const { confirm, fields } = usePlannedItemSheet(item);

  return (
    <Sheet
      confirm={confirm}
      name="move"
      subtitle={title}
      title={intl.formatMessage({ id: "calendar.today.moveTitle" })}
    >
      <SheetBody>
        <MoveFields {...fields} testID="move" />
      </SheetBody>
    </Sheet>
  );
}
