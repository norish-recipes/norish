// One merge per cached range for the realtime echo and the actor's own result, keyed by
// item id and placed by date alone, so whichever lands second is a no-op.

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";
import type { CalendarRange } from "@norish/shared/lib/helpers";

export function isDateInRange(date: string, { startISO, endISO }: CalendarRange) {
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
  range: CalendarRange
) {
  const existing = prev.find((current) => current.id === item.id);

  // A plan's version only rises on its own write, so a higher cached one is newer (a late answer).
  if (existing && existing.version > item.version) return prev;

  if (!isDateInRange(item.date, range)) {
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
  wanted: CalendarRange
): PlannedItemFromQuery[] | undefined {
  const overlapping = cached.filter(
    ({ range }) => range.startISO <= wanted.endISO && range.endISO >= wanted.startISO
  );

  if (overlapping.length === 0) return undefined;
  const known = new Map<string, PlannedItemFromQuery>();

  for (const { items } of overlapping) {
    for (const item of items) {
      if (isDateInRange(item.date, wanted) && !known.has(item.id)) {
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
 * A move as one range sees it: `moved` leaves its slot and lands at `target.sortOrder`, one version up.
 * A range that held it keeps it past its edge, so a grown range can seed from it (its read drops it).
 */
export function moveItemInRange(
  prev: PlannedItemFromQuery[],
  moved: PlannedItemFromQuery,
  target: Pick<PlannedItemFromQuery, "date" | "slot" | "sortOrder">,
  range: CalendarRange
) {
  const keepsItem = isDateInRange(target.date, range) || prev.some((item) => item.id === moved.id);

  if (!keepsItem && !isDateInRange(moved.date, range)) return prev;

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
    keepsItem
      ? [...shifted, { ...moved, ...target, version: moved.version + 1, updatedAt: new Date() }]
      : shifted
  );
}

/** A move echo as one range sees it: the item lands or leaves by its date, its slot-mates take the sent order. */
export function applyMoveEchoInRange(
  prev: PlannedItemFromQuery[],
  payload: PayloadOf<CalendarRealtime, "itemMoved">,
  range: CalendarRange
) {
  const existing = prev.find((item) => item.id === payload.item.id);

  // As in `upsertItemInRange`: a higher cached version is a later write, its order included.
  if (existing && existing.version > payload.item.version) return prev;

  const itemIsInRange = isDateInRange(payload.item.date, range);
  const sortOrders = new Map(
    [...(payload.sourceSlotItems ?? []), ...payload.targetSlotItems].map((item) => [
      item.id,
      item.sortOrder,
    ])
  );
  const updated = prev
    .filter((item) => item.id !== payload.item.id || itemIsInRange)
    .map((item) => {
      if (item.id === payload.item.id) return toPlannedItemFromPayload(payload.item, item);
      const sortOrder = sortOrders.get(item.id);

      return sortOrder === undefined ? item : { ...item, sortOrder };
    });

  if (!itemIsInRange || updated.some((item) => item.id === payload.item.id)) {
    return sortCalendarItems(updated);
  }

  return sortCalendarItems([...updated, toPlannedItemFromPayload(payload.item)]);
}
