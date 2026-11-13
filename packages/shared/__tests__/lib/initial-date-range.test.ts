import { afterEach, describe, expect, it, vi } from "vitest";

import { getInitialCalendarRange, parseDateKey } from "@norish/shared/lib/helpers";

describe("getInitialCalendarRange", () => {
  it("opens the calendar on the weeks around the given day, Monday to Sunday", () => {
    // Friday 16 October 2026.
    expect(getInitialCalendarRange("mobile", "2026-10-16")).toEqual({
      startISO: "2026-09-28",
      endISO: "2026-11-01",
    });
    expect(getInitialCalendarRange("desktop", "2026-10-16")).toEqual({
      startISO: "2026-10-12",
      endISO: "2026-10-18",
    });
  });

  it("puts a Sunday in the week that started the Monday before", () => {
    expect(getInitialCalendarRange("desktop", "2026-10-18")).toEqual({
      startISO: "2026-10-12",
      endISO: "2026-10-18",
    });
  });
});

describe("parseDateKey", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads a date key as local midnight on that day", () => {
    // West of UTC, where a UTC parse lands on the evening before.
    vi.stubEnv("TZ", "America/New_York");
    const date = parseDateKey("2026-03-29");

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 2, 29, 0,
    ]);
  });
});
