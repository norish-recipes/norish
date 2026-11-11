import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCalendarRangeStore } from "@norish/shared-react/calendar";

// A Wednesday: the range opens on the Monday two weeks back and closes on the Sunday two weeks on.
const TODAY = "2026-11-11";

describe("createCalendarRangeStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens two whole weeks either side of the given today", () => {
    expect(createCalendarRangeStore(TODAY).getState()).toMatchObject({
      range: { startISO: "2026-10-26", endISO: "2026-11-29" },
      isGrowing: false,
    });
  });

  it("grows 12 days into the past, then into the future once the grow settles", () => {
    const calendar = createCalendarRangeStore(TODAY);

    calendar.getState().grow("past");
    expect(calendar.getState()).toMatchObject({
      range: { startISO: "2026-10-14", endISO: "2026-11-29" },
      isGrowing: true,
    });

    vi.advanceTimersByTime(100);
    expect(calendar.getState().isGrowing).toBe(false);

    calendar.getState().grow("future");
    expect(calendar.getState().range).toEqual({ startISO: "2026-10-14", endISO: "2026-12-11" });
  });

  it("ignores a grow while one is settling", () => {
    const calendar = createCalendarRangeStore(TODAY);

    calendar.getState().grow("future");
    calendar.getState().grow("future");

    expect(calendar.getState().range.endISO).toBe("2026-12-11");
  });

  it("answers whether a date is in range, its first and last days included", () => {
    const calendar = createCalendarRangeStore(TODAY);
    const { isDateInRange } = calendar.getState();

    expect(isDateInRange("2026-10-26")).toBe(true);
    expect(isDateInRange("2026-11-29")).toBe(true);
    expect(isDateInRange("2026-10-25")).toBe(false);
    expect(isDateInRange("2026-11-30")).toBe(false);

    calendar.getState().grow("future");
    expect(isDateInRange("2026-11-30")).toBe(true);
  });

  it("is one store per page", () => {
    const one = createCalendarRangeStore(TODAY);
    const other = createCalendarRangeStore(TODAY);

    one.getState().grow("past");

    expect(other.getState().range.startISO).toBe("2026-10-26");
  });
});
