import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import { useCalendarMutations } from "./use-calendar-mutations";

/** Where a moved item lands in its new slot: after what is already there. */
export function moveTargetIndex(
  items: PlannedItemFromQuery[],
  moved: Pick<PlannedItemFromQuery, "id">,
  dayKey: string,
  slot: Slot
) {
  return items.filter((item) => item.id !== moved.id && item.date === dayKey && item.slot === slot)
    .length;
}

type MovePlannedItemOptions = {
  /** The item to move; one that is gone (deleted elsewhere) closes the sheet instead. */
  itemId: string;
  /** The planned items of the days on show: where the item is, and the end of the target slot. */
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
      moveItem(item.id, dayKey, slot, moveTargetIndex(items, item, dayKey, slot));
    }
    close();
  };
}
