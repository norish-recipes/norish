/**
 * How a planned item lands in a cached calendar range: the same merge for
 * the realtime echo and for the actor's own mutation result, so whichever
 * arrives first places the item and the other is a no-op (a range is keyed by
 * its `startISO`/`endISO`, and an item belongs to it by date alone).
 */

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";

export type CalendarRange = { startISO: string; endISO: string };

export function isDateInRange(date: string, startISO: string, endISO: string) {
  return date >= startISO && date <= endISO;
}

export function sortCalendarItems(items: PlannedItemFromQuery[]) {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);

    return a.sortOrder - b.sortOrder;
  });
}

export function toPlannedItemFromPayload(
  item: PlannedItemWithRecipePayload,
  existing?: PlannedItemFromQuery
): PlannedItemFromQuery {
  return {
    id: item.id,
    userId: item.userId,
    date: item.date,
    slot: item.slot,
    sortOrder: item.sortOrder,
    itemType: item.itemType,
    recipeId: item.recipeId,
    title: item.title,
    recipeName: item.recipeName,
    recipeImage: item.recipeImage,
    servings: item.servings,
    calories: item.calories,
    version: item.version ?? existing?.version ?? 1,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
}

/** Place `item` in a range by its date: replaced if known, appended if new, dropped if it left. */
export function upsertItemInRange(
  prev: PlannedItemFromQuery[],
  item: PlannedItemWithRecipePayload,
  startISO: string,
  endISO: string
) {
  const existing = prev.find((current) => current.id === item.id);

  if (!isDateInRange(item.date, startISO, endISO)) {
    return prev.filter((current) => current.id !== item.id);
  }

  const nextItem = toPlannedItemFromPayload(item, existing);
  const next = existing
    ? prev.map((current) => (current.id === item.id ? nextItem : current))
    : [...prev, nextItem];

  return sortCalendarItems(next);
}

/**
 * What the cached ranges already know about a range none of them is: their
 * items on its days, each once. Undefined when no cached range overlaps it.
 */
export function knownItemsInRange(
  cached: { range: CalendarRange; items: PlannedItemFromQuery[] }[],
  startISO: string,
  endISO: string
): PlannedItemFromQuery[] | undefined {
  const overlapping = cached.filter(
    ({ range }) => range.startISO <= endISO && range.endISO >= startISO
  );

  if (overlapping.length === 0) return undefined;
  const known = new Map<string, PlannedItemFromQuery>();

  for (const { items } of overlapping) {
    for (const item of items) {
      if (isDateInRange(item.date, startISO, endISO) && !known.has(item.id)) {
        known.set(item.id, item);
      }
    }
  }

  return sortCalendarItems([...known.values()]);
}

/**
 * The range a `calendar.listItems` query key was made for, or null for a key
 * that is not one — the bare path prefix, or a key shaped differently.
 */
export function calendarRangeOfQueryKey(queryKey: readonly unknown[]): CalendarRange | null {
  const options = queryKey[1];

  if (!options || typeof options !== "object" || !("input" in options)) return null;

  const input = (options as { input?: unknown }).input;

  if (!input || typeof input !== "object") return null;

  const { startISO, endISO } = input as Partial<CalendarRange>;

  return typeof startISO === "string" && typeof endISO === "string" ? { startISO, endISO } : null;
}

/**
 * A move as one range sees it: `moved` leaves its source slot and lands at
 * `target.sortOrder` in the target slot when the target date is in the range.
 */
export function moveItemInRange(
  prev: PlannedItemFromQuery[],
  moved: PlannedItemFromQuery,
  target: Pick<PlannedItemFromQuery, "date" | "slot" | "sortOrder">,
  { startISO, endISO }: CalendarRange
) {
  const targetInRange = isDateInRange(target.date, startISO, endISO);

  if (!targetInRange && !isDateInRange(moved.date, startISO, endISO)) return prev;

  const isSameSlot = moved.date === target.date && moved.slot === target.slot;
  const shifted = prev.flatMap((item) => {
    if (item.id === moved.id) return [];

    if (item.date === target.date && item.slot === target.slot) {
      if (isSameSlot) {
        if (item.sortOrder >= target.sortOrder && item.sortOrder < moved.sortOrder) {
          return [{ ...item, sortOrder: item.sortOrder + 1 }];
        }
        if (item.sortOrder <= target.sortOrder && item.sortOrder > moved.sortOrder) {
          return [{ ...item, sortOrder: item.sortOrder - 1 }];
        }
      } else if (item.sortOrder >= target.sortOrder) {
        return [{ ...item, sortOrder: item.sortOrder + 1 }];
      }
    }

    if (
      !isSameSlot &&
      item.date === moved.date &&
      item.slot === moved.slot &&
      item.sortOrder > moved.sortOrder
    ) {
      return [{ ...item, sortOrder: item.sortOrder - 1 }];
    }

    return [item];
  });

  return sortCalendarItems(
    targetInRange ? [...shifted, { ...moved, ...target, updatedAt: new Date() }] : shifted
  );
}
