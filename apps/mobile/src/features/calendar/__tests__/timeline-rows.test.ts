import { describe, expect, it } from "vitest";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import type { TimelineHeading, TimelineItem, TimelineRow } from "../utils/timeline-rows";
import { planTimelineDrop, rowLayouts, TIMELINE, timelineRows } from "../utils/timeline-rows";

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

  it("marks today, empty days and where a card ends", () => {
    expect(heading("day:2026-11-12")).toMatchObject({ isToday: true, empty: true });
    expect(heading("day:2026-11-11")).toMatchObject({ isToday: false, empty: false });
    expect(item("eggs")).toMatchObject({ firstInSlot: true, lastOfDay: false });
    expect(item("stew")).toMatchObject({ firstInSlot: false, lastOfDay: true });
  });
});

describe("rowLayouts", () => {
  it("stacks the rows with a gap above every card but the first", () => {
    const layouts = rowLayouts(rows);
    const day = TIMELINE.dayTop + TIMELINE.dayHeader;

    expect(layouts[0]).toEqual({ offset: 0, length: day });
    expect(layouts[2]).toEqual({ offset: day + TIMELINE.slotLabel, length: TIMELINE.photo });
    expect(layouts[5]!.length).toBe(TIMELINE.photo + TIMELINE.itemGap + TIMELINE.cardBottom);
    expect(layouts[6]!.length).toBe(TIMELINE.gap + day + TIMELINE.emptyBottom);
    expect(layouts[7]!.offset).toBe(layouts[6]!.offset + layouts[6]!.length);
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
