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
  item: PlannedItemFromQuery | undefined;
  /** The planned items of the days on show, to find the end of the target slot. */
  items: PlannedItemFromQuery[];
  close: () => void;
};

/** Moves a planned item to the end of another day's slot, then closes. Offline it queues in the Outbox. */
export function useMovePlannedItem({ item, items, close }: MovePlannedItemOptions) {
  const { moveItem } = useCalendarMutations();

  return (dayKey: string, slot: Slot) => {
    if (!item) return;
    if (item.date !== dayKey || item.slot !== slot) {
      moveItem(item.id, dayKey, slot, moveTargetIndex(items, item, dayKey, slot));
    }
    close();
  };
}
