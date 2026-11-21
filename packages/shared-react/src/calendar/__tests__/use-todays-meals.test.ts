import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { dateKey, getInitialCalendarRange } from "@norish/shared/lib/helpers";

import { useTodaysMeals } from "../use-todays-meals";

const useCalendarQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../use-calendar-query", () => ({ useCalendarQuery: useCalendarQueryMock }));
vi.mock("../use-calendar-subscription", () => ({ useCalendarSubscription: vi.fn() }));

function dinner(date: string): PlannedItemFromQuery {
  return {
    id: "planned-1",
    userId: "user-1",
    date,
    slot: "Dinner",
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "recipe-1",
    title: null,
    recipeName: "Pasta Night",
    recipeImage: null,
    servings: 4,
    calories: 640,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe("useTodaysMeals", () => {
  beforeEach(() => useCalendarQueryMock.mockReset());

  it("reads the week the dashboard layout seeds, and shows all four slots", () => {
    const todayKey = dateKey(new Date());

    useCalendarQueryMock.mockReturnValue({
      calendarData: { [todayKey]: [dinner(todayKey)] },
      isLoading: false,
    });

    const { result } = renderHook(() => useTodaysMeals(todayKey, "always"));

    expect(useCalendarQueryMock).toHaveBeenCalledWith(getInitialCalendarRange("desktop", todayKey));
    expect(result.current.visibleSlots).toEqual(["Breakfast", "Lunch", "Dinner", "Snack"]);
    expect(result.current.itemsBySlot.Dinner.map(({ recipeName }) => recipeName)).toEqual([
      "Pasta Night",
    ]);
  });

  it("follows today into the next week, and keeps the range while today stays inside it", () => {
    useCalendarQueryMock.mockReturnValue({ calendarData: {}, isLoading: false });

    const { rerender } = renderHook(({ today }) => useTodaysMeals(today, "always"), {
      initialProps: { today: "2026-11-15" },
    });

    rerender({ today: "2026-11-16" });
    expect(useCalendarQueryMock).toHaveBeenLastCalledWith({
      startISO: "2026-11-16",
      endISO: "2026-11-22",
    });

    const week = useCalendarQueryMock.mock.lastCall?.[0];

    rerender({ today: "2026-11-17" });
    expect(useCalendarQueryMock.mock.lastCall?.[0]).toEqual(week);
  });

  it("shows only slots with planned items in planned mode, none when nothing is planned", () => {
    const todayKey = dateKey(new Date());

    useCalendarQueryMock.mockReturnValue({
      calendarData: { [todayKey]: [dinner(todayKey)] },
      isLoading: false,
    });
    expect(
      renderHook(() => useTodaysMeals(todayKey, "planned")).result.current.visibleSlots
    ).toEqual(["Dinner"]);

    useCalendarQueryMock.mockReturnValue({ calendarData: {}, isLoading: false });
    expect(
      renderHook(() => useTodaysMeals(todayKey, "planned")).result.current.visibleSlots
    ).toEqual([]);
  });
});
