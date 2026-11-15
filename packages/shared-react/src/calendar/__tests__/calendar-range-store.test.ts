import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCalendarRangeStore } from "../calendar-range-store";

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

  it("reaches a day outside the range, either way, and leaves a day inside it alone", () => {
    const calendar = createCalendarRangeStore(TODAY);

    calendar.getState().reach("2026-11-20");
    expect(calendar.getState().range).toEqual({ startISO: "2026-10-26", endISO: "2026-11-29" });
    calendar.getState().reach("2027-01-04");
    calendar.getState().reach("2026-09-01");
    expect(calendar.getState().range).toEqual({ startISO: "2026-09-01", endISO: "2027-01-04" });
  });

  it("ignores a grow in the direction that is settling", () => {
    const calendar = createCalendarRangeStore(TODAY);

    calendar.getState().grow("future");
    calendar.getState().grow("future");

    expect(calendar.getState().range.endISO).toBe("2026-12-11");
  });

  it("grows the other way while one grow settles, growing until both settle", () => {
    const calendar = createCalendarRangeStore(TODAY);

    calendar.getState().grow("past");
    vi.advanceTimersByTime(50);
    calendar.getState().grow("future");

    expect(calendar.getState().range).toEqual({ startISO: "2026-10-14", endISO: "2026-12-11" });

    vi.advanceTimersByTime(50);
    expect(calendar.getState().isGrowing).toBe(true);
    vi.advanceTimersByTime(50);
    expect(calendar.getState().isGrowing).toBe(false);
  });

  it("is one store per page", () => {
    const one = createCalendarRangeStore(TODAY);
    const other = createCalendarRangeStore(TODAY);

    one.getState().grow("past");

    expect(other.getState().range.startISO).toBe("2026-10-26");
  });
});
