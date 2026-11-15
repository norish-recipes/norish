import type { PhotoLookup, WidgetStrings } from "@/lib/calendar-widgets-state";
import {
  calendarWidgetTimelines,
  lineBudget,
  signedOutTimelines,
  WEEK_LINES,
  WIDGET_DAYS,
} from "@/lib/calendar-widgets-state";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

vi.mock("expo-linking", () => ({
  createURL: (path: string, options?: { queryParams?: { day: string } }) =>
    `norish://${path.slice(1)}${options?.queryParams ? `?day=${options.queryParams.day}` : ""}`,
}));

const strings: WidgetStrings = {
  nothingPlanned: "Nothing planned",
  signIn: "Open Norish to sign in",
  open: "Open Norish",
  calendar: "Calendar",
  today: "Today",
  untitled: "Untitled",
  slots: { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snack" },
  more: (count) => `+${count} more`,
  weekday: (date) => date.toLocaleDateString("en-US", { weekday: "long" }),
  weekdayShort: (date) => date.toLocaleDateString("en-US", { weekday: "short" }),
};

const photo: PhotoLookup = (image, size) => `file:///widgets${image}-${size}`;

let ids = 0;

function recipe(date: string, slot: Slot, name: string, sortOrder = 0): PlannedItemFromQuery {
  ids += 1;

  return {
    id: `item-${ids}`,
    userId: "user",
    date,
    slot,
    sortOrder,
    itemType: "recipe",
    recipeId: `recipe-${name}`,
    title: null,
    recipeName: name,
    recipeImage: `/recipes/${name}.jpg`,
    servings: 2,
    calories: null,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function note(date: string, slot: Slot, title: string): PlannedItemFromQuery {
  return {
    ...recipe(date, slot, title),
    itemType: "note",
    recipeId: null,
    title,
    recipeName: null,
    recipeImage: null,
  };
}

function byDate(items: PlannedItemFromQuery[]) {
  const plan: Record<string, PlannedItemFromQuery[]> = {};

  for (const item of items) (plan[item.date] ??= []).push(item);

  return plan;
}

/** The small widget's entry showing at a local wall-clock time. */
function smallAt(items: PlannedItemFromQuery[], now: Date, at: Date = now) {
  const { small } = calendarWidgetTimelines(byDate(items), now.getTime(), strings, photo);

  return small.findLast((entry) => entry.date <= at.getTime())?.props;
}

const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);

let zone: string | undefined;

beforeAll(() => {
  zone = process.env.TZ;
  process.env.TZ = "Europe/Amsterdam";
});

afterAll(() => {
  process.env.TZ = zone;
});

describe("the small widget", () => {
  const day = [
    recipe("2026-11-15", "Breakfast", "Pancakes"),
    recipe("2026-11-15", "Lunch", "Soup"),
    recipe("2026-11-15", "Dinner", "Chili"),
    recipe("2026-11-16", "Breakfast", "Porridge"),
  ];

  it.each([
    [local(15, 9, 59), "Breakfast", "Pancakes"],
    [local(15, 10), "Lunch", "Soup"],
    [local(15, 13, 59), "Lunch", "Soup"],
    [local(15, 14), "Dinner", "Chili"],
    [local(15, 23, 59), "Dinner", "Chili"],
    [local(16, 0), "Breakfast", "Porridge"],
  ])("at %s shows %s", (now, slot, name) => {
    expect(smallAt(day, now)).toMatchObject({ kind: "meal", slot, name });
  });

  it("rolls through the boundaries from one push", () => {
    const now = local(15, 8);

    expect(smallAt(day, now, local(15, 10))).toMatchObject({ name: "Soup" });
    expect(smallAt(day, now, local(15, 14))).toMatchObject({ name: "Chili" });
    expect(smallAt(day, now, local(16, 0))).toMatchObject({
      name: "Porridge",
      weekday: "Monday",
      day: "16",
    });
  });

  it("falls forward to the next filled slot later today", () => {
    const items = [recipe("2026-11-15", "Dinner", "Chili")];

    expect(smallAt(items, local(15, 8))).toMatchObject({ slot: "Dinner", name: "Chili" });
  });

  it("falls forward to a snack after dinner", () => {
    const items = [recipe("2026-11-15", "Snack", "Popcorn")];

    expect(smallAt(items, local(15, 15))).toMatchObject({ slot: "Snack", name: "Popcorn" });
  });

  it("never falls into tomorrow: nothing left today opens Today", () => {
    const items = [
      recipe("2026-11-15", "Breakfast", "Pancakes"),
      recipe("2026-11-16", "Breakfast", "Porridge"),
    ];

    expect(smallAt(items, local(15, 14))).toEqual({
      kind: "empty",
      weekday: "Sunday",
      day: "15",
      text: "Nothing planned",
      url: "norish://",
    });
  });

  it("shows the first of several items in one slot", () => {
    const items = [
      recipe("2026-11-15", "Dinner", "Second", 1),
      recipe("2026-11-15", "Dinner", "First", 0),
    ];

    expect(smallAt(items, local(15, 18))).toMatchObject({ name: "First" });
  });

  it("shows a recipe's photo and opens it", () => {
    expect(smallAt([recipe("2026-11-15", "Dinner", "Chili")], local(15, 18))).toEqual({
      kind: "meal",
      weekday: "Sunday",
      day: "15",
      slot: "Dinner",
      name: "Chili",
      photo: "file:///widgets/recipes/Chili.jpg-meal",
      url: "norish://recipe/recipe-Chili",
    });
  });

  it("shows a recipe without a photo on the device yet as text", () => {
    const none: PhotoLookup = () => null;
    const { small } = calendarWidgetTimelines(
      byDate([recipe("2026-11-15", "Dinner", "Chili")]),
      local(15, 18).getTime(),
      strings,
      none
    );

    expect(small[0]?.props).toMatchObject({
      kind: "meal",
      photo: null,
      url: "norish://recipe/recipe-Chili",
    });
  });

  it("shows a note's text and opens Calendar on its day", () => {
    expect(smallAt([note("2026-11-15", "Lunch", "Leftovers")], local(15, 11))).toEqual({
      kind: "meal",
      weekday: "Sunday",
      day: "15",
      slot: "Lunch",
      name: "Leftovers",
      photo: null,
      url: "norish://calendar?day=2026-11-15",
    });
  });
});

describe("the timelines", () => {
  it("start with the entry showing now and step at midnight, 10:00 and 14:00 for 14 days", () => {
    const now = local(15, 11, 30);
    const { small, large } = calendarWidgetTimelines({}, now.getTime(), strings, photo);

    expect(small[0]?.date).toBe(local(15, 10).getTime());
    expect(small[1]?.date).toBe(local(15, 14).getTime());
    expect(small[2]?.date).toBe(local(16, 0).getTime());
    // Two today, three on each of the 13 days after, and the run-out entry.
    expect(small).toHaveLength(2 + 3 * (WIDGET_DAYS - 1) + 1);
    expect(large.map((entry) => entry.date)).toEqual(
      Array.from({ length: WIDGET_DAYS + 1 }, (_, offset) => local(15 + offset, 0).getTime())
    );
  });

  it("show 'Open Norish' after the 14-day horizon, opening Today", () => {
    const { small, large } = calendarWidgetTimelines({}, local(15, 8).getTime(), strings, photo);
    const runOut = { kind: "message", text: "Open Norish", url: "norish://" };

    expect(small.at(-1)).toEqual({ date: local(29, 0).getTime(), props: runOut });
    expect(large.at(-1)).toEqual({ date: local(29, 0).getTime(), props: runOut });
    expect(small.at(-2)?.props).toMatchObject({ kind: "empty", day: "28" });
  });

  it("match on a resync later in the same period", () => {
    const plan = byDate([recipe("2026-11-15", "Dinner", "Chili")]);
    const first = calendarWidgetTimelines(plan, local(15, 14, 5).getTime(), strings, photo);
    const again = calendarWidgetTimelines(plan, local(15, 16).getTime(), strings, photo);

    expect(again).toEqual(first);
  });

  it("keep each boundary on its local hour across a daylight-saving change", () => {
    // Europe/Amsterdam springs forward on 28 March 2027.
    const now = new Date(2027, 2, 25, 9);
    const { small, large } = calendarWidgetTimelines({}, now.getTime(), strings, photo);
    const hours = small.slice(0, -1).map((entry) => new Date(entry.date).getHours());

    expect(new Set(hours)).toEqual(new Set([0, 10, 14]));
    const midnights = large.map((entry) => new Date(entry.date));

    expect(midnights.every((date) => date.getHours() === 0)).toBe(true);
    expect(midnights.map((date) => date.getDate()).slice(0, 5)).toEqual([25, 26, 27, 28, 29]);
    // The spring-forward day is 23 hours long.
    expect(midnights[4]!.getTime() - midnights[3]!.getTime()).toBe(23 * 3_600_000);
  });

  it("follow the device's time zone", () => {
    const instant = Date.UTC(2026, 10, 15, 23, 30);
    const items = [
      recipe("2026-11-15", "Dinner", "Chili"),
      recipe("2026-11-16", "Breakfast", "Porridge"),
    ];

    // 00:30 on the 16th in Amsterdam, 18:30 on the 15th in New York.
    expect(smallAt(items, new Date(instant))).toMatchObject({ name: "Porridge" });
    process.env.TZ = "America/New_York";
    try {
      expect(smallAt(items, new Date(instant))).toMatchObject({ name: "Chili" });
    } finally {
      process.env.TZ = "Europe/Amsterdam";
    }
  });
});

describe("the large widget", () => {
  it("shows today and the six days after it, today first and ringed", () => {
    const items = [
      recipe("2026-11-15", "Dinner", "Chili"),
      note("2026-11-15", "Lunch", "Leftovers"),
      recipe("2026-11-21", "Dinner", "Tacos"),
      recipe("2026-11-22", "Dinner", "Beyond the week"),
    ];
    const { large } = calendarWidgetTimelines(
      byDate(items),
      local(15, 9).getTime(),
      strings,
      photo
    );
    const week = large[0]?.props;

    expect(week).toMatchObject({
      kind: "week",
      title: "Calendar",
      url: "norish://calendar?day=2026-11-15",
    });
    if (week?.kind !== "week") throw new Error("expected a week");
    expect(week.days.map((day) => [day.weekday, day.day, day.today])).toEqual([
      ["Today", "15", true],
      ["Mon", "16", false],
      ["Tue", "17", false],
      ["Wed", "18", false],
      ["Thu", "19", false],
      ["Fri", "20", false],
      ["Sat", "21", false],
    ]);
    // By slot: the lunch note before the dinner recipe.
    expect(week.days[0]?.lines).toEqual([
      {
        id: expect.any(String),
        name: "Leftovers",
        note: true,
        photo: null,
        url: "norish://calendar?day=2026-11-15",
      },
      {
        id: expect.any(String),
        name: "Chili",
        note: false,
        photo: "file:///widgets/recipes/Chili.jpg-thumb",
        url: "norish://recipe/recipe-Chili",
      },
    ]);
    expect(week.days[1]).toMatchObject({ lines: [], url: "norish://calendar?day=2026-11-16" });
  });

  it("moves its week on at midnight", () => {
    const { large } = calendarWidgetTimelines({}, local(15, 9).getTime(), strings, photo);
    const next = large[1]?.props;

    if (next?.kind !== "week") throw new Error("expected a week");
    expect(next.days[0]).toMatchObject({ weekday: "Today", day: "16", today: true });
    expect(next.days[6]).toMatchObject({ day: "22" });
  });

  it("ends a crowded day on +N", () => {
    const items = ["A", "B", "C", "D", "E", "F"].map((name, index) =>
      recipe("2026-11-15", "Dinner", name, index)
    );
    const { large } = calendarWidgetTimelines(
      byDate(items),
      local(15, 9).getTime(),
      strings,
      photo
    );
    const week = large[0]?.props;

    if (week?.kind !== "week") throw new Error("expected a week");
    expect(week.days[0]?.lines.map((line) => line.name)).toEqual(["A", "B", "C", "+3 more"]);
  });
});

describe("lineBudget", () => {
  it("gives every day with items a line before any day a second", () => {
    expect(lineBudget([5, 5, 5, 5, 5, 5, 5])).toEqual([4, 1, 1, 1, 1, 1, 1]);
    expect(lineBudget([2, 0, 2, 1, 0, 2, 2])).toEqual([2, 0, 2, 1, 0, 2, 1]);
    expect(lineBudget([9, 0, 0, 0, 0, 0, 0])).toEqual([WEEK_LINES - 6, 0, 0, 0, 0, 0, 0]);
  });
});

describe("signedOutTimelines", () => {
  it("show one line that opens Sign in", () => {
    const message = { kind: "message", text: "Open Norish to sign in", url: "norish://" };

    expect(signedOutTimelines(strings)).toEqual({
      small: [{ date: 0, props: message }],
      large: [{ date: 0, props: message }],
    });
  });
});
