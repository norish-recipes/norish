import { describe, expect, it } from "vitest";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import type { TimelineHeading, TimelineItem, TimelineRow } from "../utils/timeline-rows";
import {
  dayRowKey,
  hiddenAbove,
  itemHeight,
  planTimelineDrop,
  rowDay,
  rowLayout,
  TIMELINE,
  timelineRows,
} from "../utils/timeline-rows";

function planned(id: string, date: string, slot: Slot, sortOrder = 0): PlannedItemFromQuery {
  return {
    id,
    userId: "u",
    date,
    slot,
    sortOrder,
    itemType: "note",
    recipeId: null,
    title: id,
    recipeName: null,
    recipeImage: null,
    servings: null,
    calories: null,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

const days = [new Date(2026, 10, 11), new Date(2026, 10, 12), new Date(2026, 10, 13)];
const data = {
  "2026-11-11": [
    planned("stew", "2026-11-11", "Dinner", 1),
    planned("soup", "2026-11-11", "Dinner", 0),
    planned("eggs", "2026-11-11", "Breakfast"),
  ],
  "2026-11-13": [planned("toast", "2026-11-13", "Dinner")],
};
const rows = timelineRows(days, data, "2026-11-12");

const heading = (key: string) => rows.find((row) => row.key === key)!.value as TimelineHeading;
const item = (id: string) => rows.find((row) => row.key === `item:${id}`)!.value as TimelineItem;

describe("timelineRows", () => {
  it("lays each day out as its top, then each filled slot's label and items in order", () => {
    expect(rows.map((row) => row.key)).toEqual([
      "day:2026-11-11",
      "slot:2026-11-11:Breakfast",
      "item:eggs",
      "slot:2026-11-11:Dinner",
      "item:soup",
      "item:stew",
      "day:2026-11-12",
      "day:2026-11-13",
      "slot:2026-11-13:Dinner",
      "item:toast",
    ]);
  });

  it("marks today, empty days, the gap above every card but the first, and where a card ends", () => {
    expect(heading("day:2026-11-12")).toMatchObject({ isToday: true, empty: true, gap: true });
    expect(heading("day:2026-11-11")).toMatchObject({ isToday: false, empty: false, gap: false });
    expect(item("eggs")).toMatchObject({ firstInSlot: true, lastOfDay: false });
    expect(item("stew")).toMatchObject({ firstInSlot: false, lastOfDay: true });
  });

  it("keys a day's row by its day, and tells each row's day", () => {
    expect(rows.find((row) => row.key === dayRowKey("2026-11-12"))?.kind).toBe("heading");
    expect(rows.map(rowDay).slice(4, 8)).toEqual([
      "2026-11-11",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
    ]);
  });
});

describe("hiddenAbove", () => {
  it("changes when a row above the first shown day goes, so the list takes it without sliding", () => {
    const without = timelineRows(days, { ...data, "2026-11-11": [] }, "2026-11-12");

    expect(hiddenAbove(without, "2026-11-12")).not.toBe(hiddenAbove(rows, "2026-11-12"));
  });

  it("stays while the shown days and those below change", () => {
    const later = timelineRows(
      days,
      { ...data, "2026-11-13": [planned("pie", "2026-11-13", "Lunch")] },
      "2026-11-12"
    );

    expect(hiddenAbove(later, "2026-11-12")).toBe(hiddenAbove(rows, "2026-11-12"));
  });
});

describe("rowLayout", () => {
  it("stacks the rows with a gap above every card but the first", () => {
    const layouts = rows.map((_, index) => rowLayout(rows, index));
    const day = TIMELINE.dayTop + TIMELINE.dayHeader;

    expect(layouts[0]).toEqual({ offset: 0, length: day });
    expect(layouts[2]).toEqual({ offset: day + TIMELINE.slotLabel, length: TIMELINE.photo });
    expect(layouts[5]!.length).toBe(TIMELINE.photo + TIMELINE.itemGap + TIMELINE.cardBottom);
    expect(layouts[6]!.length).toBe(TIMELINE.gap + day + TIMELINE.emptyBottom);
    expect(layouts[7]!.offset).toBe(layouts[6]!.offset + layouts[6]!.length);
    expect(layouts[5]!.length).toBe(itemHeight(item("stew")));
  });

  it("grows each row's text room with the font scale, the photo's height its least", () => {
    const at = (scale: number) => rows.map((_, index) => rowLayout(rows, index, scale).length);

    expect(at(0.8)).toEqual(at(1));
    expect(itemHeight(item("eggs"), 3)).toBe(Math.ceil(TIMELINE.lines.item * 3));
    expect(rowLayout(rows, 1, 3).length).toBe(Math.ceil(TIMELINE.lines.slot * 3) + 18);
    expect(rowLayout(rows, 0, 3).length).toBe(
      TIMELINE.dayTop + Math.ceil(TIMELINE.lines.day * 3) + 24
    );
    expect(rowLayout(rows, 9, 3).offset).toBe(
      at(3)
        .slice(0, 9)
        .reduce((sum, length) => sum + length, 0)
    );
  });

  it("lays out the rows it is given, whatever the plan is now", () => {
    // Held under a drag: another member's plan lands above, another's leaves the last day.
    const now = timelineRows(
      days,
      { ...data, "2026-11-11": [...data["2026-11-11"], planned("pie", "2026-11-11", "Lunch")] },
      "2026-11-12"
    );
    const last = rows.length - 1;

    expect(rowLayout(now, now.length - 1).offset).toBeGreaterThan(rowLayout(rows, last).offset);
    expect(rowLayout(rows, last)).toEqual({
      offset: rows.slice(0, last).reduce((sum, _, index) => sum + rowLayout(rows, index).length, 0),
      length: itemHeight(item("toast")),
    });
  });
});

describe("planTimelineDrop", () => {
  const drop = (id: string, under: string | null) => ({
    item: item(id),
    heading: under === null ? null : heading(under),
    rows: [] as TimelineRow[],
  });

  it("moves to the day of the heading above, keeping the slot, last in it", () => {
    expect(planTimelineDrop(drop("soup", "slot:2026-11-13:Dinner"), data)).toEqual({
      itemId: "soup",
      date: "2026-11-13",
      slot: "Dinner",
      index: 1,
    });
    expect(planTimelineDrop(drop("eggs", "day:2026-11-12"), data)).toMatchObject({
      date: "2026-11-12",
      slot: "Breakfast",
      index: 0,
    });
  });

  it.each([
    ["above the first day", "soup", null],
    ["on its own day", "soup", "slot:2026-11-11:Breakfast"],
  ])("means nothing %s", (_, id, under) => {
    expect(planTimelineDrop(drop(id, under), data)).toBeNull();
  });

  it("means nothing for an item that is gone when it lands", () => {
    expect(planTimelineDrop(drop("soup", "day:2026-11-12"), { "2026-11-13": [] })).toBeNull();
  });
});
