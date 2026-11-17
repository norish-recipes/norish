import { describe, expect, it } from "vitest";

import { STRIP_DAYS, stripDays } from "../../src/lib/strip-days";

describe("stripDays", () => {
  it("is today and the thirteen days after it", () => {
    expect(stripDays("2026-11-12")).toEqual([
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
  });

  it.each([
    ["the spring forward", "2026-03-22", "2026-03-29", "2026-04-04"],
    ["the autumn fall back", "2026-10-18", "2026-10-25", "2026-10-31"],
  ])("keeps one chip a day across %s", (_, start, changeDay, last) => {
    const keys = stripDays(start);

    expect(keys).toContain(changeDay);
    expect(new Set(keys).size).toBe(STRIP_DAYS);
    expect(keys.at(-1)).toBe(last);
  });
});
