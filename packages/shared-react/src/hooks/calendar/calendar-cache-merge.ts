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
