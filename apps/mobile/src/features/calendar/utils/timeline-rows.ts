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
} & (
  | {
      type: "day";
      date: Date;
      empty: boolean;
      /** A gap above: every card but the first. */
      gap: boolean;
    }
  | { type: "slot"; slot: Slot }
);

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
  /** The text's line heights at font scale 1: an item's title and details, a date, a slot label. */
  lines: { item: 22 + 2 + 20, day: 28, slot: 18 },
} as const;

// A row holds its text at the reader's font scale, and never shrinks below its drawn height.
const fit = (least: number, line: number, padding: number, scale: number) =>
  Math.max(least, Math.ceil(line * scale) + padding);

/** An item's photo-and-text line, at a font scale. */
export const itemLineHeight = (scale = 1) => fit(TIMELINE.photo, TIMELINE.lines.item, 0, scale);

/** A day top's date row, at a font scale. */
export const dayHeaderHeight = (scale = 1) =>
  fit(TIMELINE.dayHeader, TIMELINE.lines.day, 24, scale);

/** A slot label, at a font scale. */
export const slotLabelHeight = (scale = 1) =>
  fit(TIMELINE.slotLabel, TIMELINE.lines.slot, 18, scale);

/** A day top's row key. */
export const dayRowKey = (dayKey: string) => `day:${dayKey}`;

/** The day a row belongs to. */
export const rowDay = (row: TimelineRow) =>
  row.kind === "heading" ? row.value.dayKey : row.value.item.date;

/** The rows above `day`, as one key: a change to it is one the reader doesn't see, which the list
 * takes without sliding its rows so it keeps its place. */
export const hiddenAbove = (rows: readonly TimelineRow[], day: string) =>
  rows
    .filter((row) => rowDay(row) < day)
    .map((row) => row.key)
    .join();

/** One row per day top, filled slot and planned item, from the first day to the last. */
export function timelineRows(days: Date[], data: CalendarData, todayKey: string): TimelineRow[] {
  return days.flatMap((date, dayIndex): TimelineRow[] => {
    const key = dateKey(date);
    const isToday = key === todayKey;
    const bySlot = groupTodayItemsBySlot(data[key] ?? []);
    const slots = TODAY_MEAL_SLOTS.filter((slot) => bySlot[slot].length > 0);
    const last = slots.at(-1);

    return [
      {
        kind: "heading",
        key: dayRowKey(key),
        value: {
          type: "day",
          dayKey: key,
          isToday,
          date,
          empty: slots.length === 0,
          gap: dayIndex > 0,
        },
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

/** A planned item's row: its line, the gap above it in its slot, the card's close under the last. */
export function itemHeight({ firstInSlot, lastOfDay }: TimelineItem, scale = 1): number {
  return (
    itemLineHeight(scale) +
    (firstInSlot ? 0 : TIMELINE.itemGap) +
    (lastOfDay ? TIMELINE.cardBottom : 0)
  );
}

/** A row's height without the gap above a card; `rowLayout` adds that. */
export function rowHeight(row: TimelineRow, scale = 1): number {
  if (row.kind === "item") return itemHeight(row.value, scale);
  if (row.value.type === "slot") return slotLabelHeight(scale);

  return TIMELINE.dayTop + dayHeaderHeight(scale) + (row.value.empty ? TIMELINE.emptyBottom : 0);
}

const rowLength = (row: TimelineRow, scale: number) =>
  rowHeight(row, scale) +
  (row.kind === "heading" && row.value.type === "day" && row.value.gap ? TIMELINE.gap : 0);

type Layouts = { scale: number; layouts: { offset: number; length: number }[] };

// Per rows array: a list asks for every row's layout, so each set is added up once.
const layoutsOf = new WeakMap<ArrayLike<TimelineRow>, Layouts>();

/** Row `index`'s top edge and full length, its gap included, among `rows` (the rows the list
 * shows) at the reader's font scale. */
export function rowLayout(rows: ArrayLike<TimelineRow>, index: number, scale = 1) {
  let known = layoutsOf.get(rows);

  if (known?.scale !== scale) {
    let offset = 0;

    known = {
      scale,
      layouts: Array.from(rows, (row) => {
        const layout = { offset, length: rowLength(row, scale) };

        offset += layout.length;

        return layout;
      }),
    };
    layoutsOf.set(rows, known);
  }

  return known.layouts[index] ?? { offset: 0, length: 0 };
}

/** Where a held item dropped: resolved by id against the plan as it is when it lands, onto the
 * day of the heading above, in its own slot, last. Null for a drop that means nothing. */
export function planTimelineDrop(drop: Drop<TimelineHeading, TimelineItem>, data: CalendarData) {
  const dayKey = drop.heading?.dayKey ?? null;
  const item = Object.values(data)
    .flat()
    .find(({ id }) => id === drop.item.item.id);

  if (!item || !dayKey) return null;
  const target = dayDropTarget(data[dayKey] ?? [], item, dayKey);

  return target && { itemId: item.id, ...target };
}
