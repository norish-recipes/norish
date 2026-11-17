import { describe, expect, it } from "vitest";

import { dateKey } from "@norish/shared/lib/helpers";

import { sameDay, STRIP_DAYS, stripDays } from "../../src/components/strip-days";

describe("stripDays", () => {
  it("is today and the thirteen days after it, each at local midnight", () => {
    const days = stripDays(new Date(2026, 10, 12));

    expect(days).toHaveLength(STRIP_DAYS);
    expect(days.map(dateKey)).toEqual([
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
    ]);
    expect(days.every((day) => day.getHours() === 0)).toBe(true);
  });

  it.each([
    ["the spring forward", new Date(2026, 2, 22), "2026-03-29", "2026-04-04"],
    ["the autumn fall back", new Date(2026, 9, 18), "2026-10-25", "2026-10-31"],
  ])("keeps one chip a day across %s", (_, start, changeDay, last) => {
    const days = stripDays(start);
    const keys = days.map(dateKey);

    expect(keys).toContain(changeDay);
    expect(new Set(keys).size).toBe(STRIP_DAYS);
    expect(keys.at(-1)).toBe(last);
    expect(days.every((day) => day.getHours() === 0)).toBe(true);
  });
});

describe("sameDay", () => {
  it("compares calendar days, not instants", () => {
    expect(sameDay(new Date(2026, 10, 12, 0), new Date(2026, 10, 12, 23, 59))).toBe(true);
    expect(sameDay(new Date(2026, 10, 12, 23, 59), new Date(2026, 10, 13, 0))).toBe(false);
  });
});
