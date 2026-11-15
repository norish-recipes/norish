import type { DragRow, Drop } from "@/components/drag-list/resolve-drop";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import { dayDropTarget } from "@norish/shared-react/calendar";
import {
  groupTodayItemsBySlot,
  TODAY_MEAL_SLOTS,
} from "@norish/shared-react/calendar/todays-meals";
import { dateKey } from "@norish/shared/lib/helpers";

/** What is planned, by day key. */
type CalendarData = Record<string, PlannedItemFromQuery[]>;

/** A day card's top (its date and add) or one of its slot labels; a drop lands on its day. */
export type TimelineHeading = {
  dayKey: string;
  isToday: boolean;
} & ({ type: "day"; date: Date; empty: boolean } | { type: "slot"; slot: Slot });

/** A planned item's row; the first in its slot sits under the label, the last ends its card. */
export type TimelineItem = {
  item: PlannedItemFromQuery;
  isToday: boolean;
  firstInSlot: boolean;
  lastOfDay: boolean;
};

export type TimelineRow = DragRow<TimelineHeading, TimelineItem>;

/** The measures in points, so a list lays the rows out unmeasured and opens on a day at once. */
export const TIMELINE = {
  /** Between two cards: `CardSlice`'s `gap` (pt-3.5). */
  gap: 14,
  /** The card's top padding, then its date row. */
  dayTop: 6,
  dayHeader: 52,
  /** An empty day's card closes under its date. */
  emptyBottom: 6,
  slotLabel: 36,
  photo: 52,
  /** Between two items of one slot. */
  itemGap: 8,
  /** Below the last item, closing the card. */
  cardBottom: 14,
} as const;

/** One row per day top, filled slot and planned item, from the first day to the last. */
export function timelineRows(days: Date[], data: CalendarData, todayKey: string): TimelineRow[] {
  return days.flatMap((date): TimelineRow[] => {
    const key = dateKey(date);
    const isToday = key === todayKey;
    const bySlot = groupTodayItemsBySlot(data[key] ?? []);
    const slots = TODAY_MEAL_SLOTS.filter((slot) => bySlot[slot].length > 0);
    const last = slots.at(-1);

    return [
      {
        kind: "heading",
        key: `day:${key}`,
        value: { type: "day", dayKey: key, isToday, date, empty: slots.length === 0 },
      },
      ...slots.flatMap((slot): TimelineRow[] => [
        {
          kind: "heading",
          key: `slot:${key}:${slot}`,
          value: { type: "slot", dayKey: key, isToday, slot },
        },
        ...bySlot[slot].map((item, index, inSlot): TimelineRow => ({
          kind: "item",
          key: `item:${item.id}`,
          value: {
            item,
            isToday,
            firstInSlot: index === 0,
            lastOfDay: slot === last && index === inSlot.length - 1,
          },
        })),
      ]),
    ];
  });
}

/** A row's height without the gap above a card; `rowOffsets` adds that. */
export function rowHeight(row: TimelineRow): number {
  if (row.kind === "item") {
    const { firstInSlot, lastOfDay } = row.value;

    return (
      TIMELINE.photo + (firstInSlot ? 0 : TIMELINE.itemGap) + (lastOfDay ? TIMELINE.cardBottom : 0)
    );
  }
  if (row.value.type === "slot") return TIMELINE.slotLabel;

  return TIMELINE.dayTop + TIMELINE.dayHeader + (row.value.empty ? TIMELINE.emptyBottom : 0);
}

/** Whether a gap sits above the row: every card's top but the first. */
export const hasGapAbove = (row: TimelineRow, index: number) =>
  index > 0 && row.kind === "heading" && row.value.type === "day";

/** Each row's top edge and full length, its gap included. */
export function rowLayouts(rows: TimelineRow[]) {
  let offset = 0;

  return rows.map((row, index) => {
    const length = rowHeight(row) + (hasGapAbove(row, index) ? TIMELINE.gap : 0);
    const layout = { offset, length };

    offset += length;

    return layout;
  });
}

/**
 * Where a held item dropped: resolved by id against the plan as it is when it lands, onto the
 * day of the heading above, in its own slot, last. Null for a drop that means nothing.
 */
export function planTimelineDrop(drop: Drop<TimelineHeading, TimelineItem>, data: CalendarData) {
  const dayKey = drop.heading?.dayKey ?? null;
  const item = Object.values(data)
    .flat()
    .find(({ id }) => id === drop.item.item.id);

  if (!item || !dayKey) return null;
  const target = dayDropTarget(data[dayKey] ?? [], item, dayKey);

  return target && { itemId: item.id, ...target };
}
