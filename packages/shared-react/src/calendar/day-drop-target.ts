import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import { moveTargetIndex } from "./calendar-cache-merge";

/** Where a planned item dropped on a day lands: that day, its own slot, last in it. Null for a
 * drop on no day or on its own day, which moves nothing. */
export function dayDropTarget(
  items: PlannedItemFromQuery[],
  dropped: Pick<PlannedItemFromQuery, "id" | "date" | "slot">,
  dayKey: string | null
) {
  if (!dayKey || dayKey === dropped.date) return null;

  return {
    date: dayKey,
    slot: dropped.slot,
    index: moveTargetIndex(items, dropped, dayKey, dropped.slot),
  };
}
