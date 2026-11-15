import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dateKey } from "@norish/shared/lib/helpers";

import { miniCalendarRange, useMiniCalendar } from "../use-mini-calendar";

const useCalendarQueryMock = vi.hoisted(() => vi.fn());
const subscription = vi.hoisted(() => vi.fn());

vi.mock("../use-calendar-query", () => ({ useCalendarQuery: useCalendarQueryMock }));
vi.mock("../use-calendar-subscription", () => ({ useCalendarSubscription: subscription }));

describe("miniCalendarRange", () => {
  it("runs from the first of last month to the last of next month", () => {
    const { startISO, endISO, days } = miniCalendarRange(new Date(2026, 10, 13));

    expect(startISO).toBe("2026-10-01");
    expect(endISO).toBe("2026-12-31");
    expect(days).toHaveLength(31 + 30 + 31);
    expect(dateKey(days[0]!)).toBe("2026-10-01");
    expect(dateKey(days.at(-1)!)).toBe("2026-12-31");
  });

  it("crosses a year", () => {
    const { startISO, endISO } = miniCalendarRange(new Date(2026, 0, 5));

    expect(startISO).toBe("2025-12-01");
    expect(endISO).toBe("2026-02-28");
  });
});

describe("useMiniCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the range, subscribes, and finds today among the days", () => {
    useCalendarQueryMock.mockReturnValue({ calendarData: { "2026-11-13": [] }, isLoading: false });

    const { result } = renderHook(() => useMiniCalendar(new Date(2026, 10, 13)));

    expect(useCalendarQueryMock).toHaveBeenCalledWith({
      startISO: "2026-10-01",
      endISO: "2026-12-31",
    });
    expect(subscription).toHaveBeenCalled();
    expect(result.current.todayKey).toBe("2026-11-13");
    expect(result.current.todayIndex).toBe(31 + 12);
    expect(dateKey(result.current.days[result.current.todayIndex]!)).toBe("2026-11-13");
    expect(result.current.isLoading).toBe(false);
  });
});
