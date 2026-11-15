import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import { moveTargetIndex } from "./calendar-cache-merge";
import { useCalendarMutations } from "./use-calendar-mutations";

/** Where a planned item dropped on a day lands: that day, its own slot, last in it. Null for a
 * drop on no day or on its own day, which moves nothing. */
export function dayDropTarget(
  items: PlannedItemFromQuery[],
  dropped: Pick<PlannedItemFromQuery, "id" | "userId" | "date" | "slot">,
  dayKey: string | null
) {
  if (!dayKey || dayKey === dropped.date) return null;

  return {
    date: dayKey,
    slot: dropped.slot,
    index: moveTargetIndex(items, dropped, dayKey, dropped.slot),
  };
}

type MovePlannedItemOptions = {
  /** The item to move; one that is gone (deleted elsewhere) closes the sheet instead. */
  itemId: string;
  /** The planned items of the days on show: where the item is. */
  items: PlannedItemFromQuery[];
  close: () => void;
};

/** Moves a planned item to the end of another day's slot, then closes. Offline it queues in the Outbox. */
export function useMovePlannedItem({ itemId, items, close }: MovePlannedItemOptions) {
  const { moveItem } = useCalendarMutations();
  const item = items.find(({ id }) => id === itemId);

  return (dayKey: string, slot: Slot) => {
    if (!item) return close();
    if (item.date !== dayKey || item.slot !== slot) {
      moveItem(item.id, dayKey, slot);
    }
    close();
  };
}
